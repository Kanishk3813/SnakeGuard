"""
Offline Sync Manager
Handles syncing queued detections when connection is restored
"""
import os
import time
import threading
import requests
from offline_queue import OfflineQueue
from datetime import datetime

# Constants
SYNC_INTERVAL = 60  # Default sync interval in seconds

# Optional supabase import (only needed when syncing)
try:
    from supabase import create_client, Client  # type: ignore
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None  # type: ignore
    def create_client(*args, **kwargs):
        raise ImportError("supabase package not installed. Install with: pip install supabase")

class OfflineSync:
    def __init__(self, supabase_url, supabase_key, app_base_url):
        if not SUPABASE_AVAILABLE:
            raise ImportError("supabase package required for syncing. Install with: pip install supabase")
        self.supabase = create_client(supabase_url, supabase_key)
        self.app_base_url = app_base_url
        self.queue = OfflineQueue()
        self.syncing = False
    
    def check_connection(self):
        """Check if internet connection is available"""
        try:
            response = requests.get("https://www.google.com", timeout=3)
            return response.status_code == 200
        except:
            return False
    
    def sync_detection(self, queued_detection):
        """
        Sync a single queued detection to Supabase
        
        Args:
            queued_detection: Dict from detection_queue table
        
        Returns:
            success: bool, detection_id: str or None
        """
        detection_id = queued_detection['detection_id']
        image_path = queued_detection['image_path']
        
        try:
            # Check if image file still exists
            if not os.path.exists(image_path):
                print(f"⚠️ Image not found for {detection_id}: {image_path}")
                return False, None
            
            # Upload image to Supabase storage
            image_name = f"{detection_id}.jpg"
            with open(image_path, "rb") as f:
                result = self.supabase.storage.from_("snake-images").upload(image_name, f)
            
            if not result:
                print(f"❌ Storage upload failed for {detection_id}")
                self.queue.increment_upload_attempts(detection_id)
                return False, None
            
            # Get public URL
            public_url = self.supabase.storage.from_("snake-images").get_public_url(image_name)
            
            # Parse metadata
            metadata = {}
            if queued_detection['metadata']:
                import json
                metadata = json.loads(queued_detection['metadata'])
            
            # Insert into database
            detection_data = {
                "timestamp": queued_detection['timestamp'],
                "confidence": queued_detection['confidence'],
                "image_url": public_url,
            }
            
            if queued_detection['latitude']:
                detection_data['latitude'] = queued_detection['latitude']
            if queued_detection['longitude']:
                detection_data['longitude'] = queued_detection['longitude']
            
            response = self.supabase.table("snake_detections").insert(detection_data).execute()
            
            if response.data and len(response.data) > 0:
                uploaded_id = response.data[0].get('id')
                print(f"✅ Synced detection {detection_id} → {uploaded_id}")
                
                # Mark as synced
                self.queue.mark_synced(detection_id)
                
                # Optionally trigger pipeline
                auto_trigger = os.environ.get("AUTO_TRIGGER_PIPELINE", "0") == "1"
                if auto_trigger:
                    try:
                        pipeline_url = f"{self.app_base_url}/api/detections/process"
                        requests.post(
                            pipeline_url,
                            json={"detectionId": uploaded_id},
                            timeout=10
                        )
                    except Exception as e:
                        print(f"⚠️ Pipeline trigger failed (non-critical): {e}")
                
                # Clean up local image if synced successfully
                try:
                    os.remove(image_path)
                except:
                    pass  # Don't fail if cleanup fails
                
                return True, uploaded_id
            else:
                print(f"❌ Database insert failed for {detection_id}")
                self.queue.increment_upload_attempts(detection_id)
                return False, None
                
        except Exception as e:
            print(f"❌ Sync failed for {detection_id}: {e}")
            self.queue.increment_upload_attempts(detection_id)
            return False, None
    
    def sync_all(self, batch_size=5):
        """
        Sync all unsynced detections
        
        Args:
            batch_size: Number of detections to sync at once
        
        Returns:
            stats: dict with sync statistics
        """
        if self.syncing:
            return {"status": "already_syncing"}
        
        if not self.check_connection():
            return {"status": "no_connection", "synced": 0, "failed": 0}
        
        self.syncing = True
        stats = {"synced": 0, "failed": 0, "total": 0}
        
        try:
            unsynced = self.queue.get_unsynced_detections(limit=batch_size)
            stats["total"] = len(unsynced)
            
            for detection in unsynced:
                success, _ = self.sync_detection(detection)
                if success:
                    stats["synced"] += 1
                else:
                    stats["failed"] += 1
                
                # Small delay between uploads
                time.sleep(1)
            
            return {"status": "completed", **stats}
        finally:
            self.syncing = False
    
    def start_background_sync(self, interval=SYNC_INTERVAL):
        """Start background thread to periodically sync detections"""
        def sync_loop():
            while True:
                try:
                    stats = self.sync_all()
                    if stats.get("synced", 0) > 0:
                        print(f"🔄 Background sync: {stats['synced']} synced, {stats.get('failed', 0)} failed")
                except Exception as e:
                    print(f"⚠️ Background sync error: {e}")
                
                time.sleep(interval)
        
        thread = threading.Thread(target=sync_loop, daemon=True)
        thread.start()
        return thread

