"""
Offline Detection Queue Manager
Stores detections locally when offline and syncs when connection is restored
"""
import json
import sqlite3
import os
from datetime import datetime
from pathlib import Path
import threading
import time

QUEUE_DB_PATH = os.path.join(os.path.dirname(__file__), "detection_queue.db")
MAX_QUEUE_SIZE = 1000  # Maximum detections to queue
SYNC_INTERVAL = 60  # Check for connection every 60 seconds

class OfflineQueue:
    def __init__(self):
        self.db_path = QUEUE_DB_PATH
        self.lock = threading.Lock()
        self._init_database()
    
    def _init_database(self):
        """Initialize SQLite database for queue storage"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS detection_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    detection_id TEXT UNIQUE,
                    image_path TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    timestamp TEXT NOT NULL,
                    latitude REAL,
                    longitude REAL,
                    metadata TEXT,  -- JSON string for additional data
                    upload_attempts INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    synced INTEGER DEFAULT 0
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_synced ON detection_queue(synced, created_at)
            """)
            conn.commit()
    
    def add_detection(self, image_path, confidence, latitude=None, longitude=None, metadata=None):
        """
        Add a detection to the queue
        
        Args:
            image_path: Path to the detection image
            confidence: Detection confidence score
            latitude: GPS latitude (optional)
            longitude: GPS longitude (optional)
            metadata: Additional metadata dict (optional)
        
        Returns:
            detection_id: Unique ID for this queued detection
        """
        detection_id = f"offline_{int(time.time() * 1000)}"
        timestamp = datetime.utcnow().isoformat()
        
        with self.lock:
            with sqlite3.connect(self.db_path) as conn:
                # Check queue size
                count = conn.execute("SELECT COUNT(*) FROM detection_queue WHERE synced = 0").fetchone()[0]
                if count >= MAX_QUEUE_SIZE:
                    print(f"⚠️ Queue full ({count} items). Removing oldest unsynced detection.")
                    # Remove oldest unsynced detection
                    conn.execute("""
                        DELETE FROM detection_queue 
                        WHERE id = (
                            SELECT id FROM detection_queue 
                            WHERE synced = 0 
                            ORDER BY created_at ASC 
                            LIMIT 1
                        )
                    """)
                
                # Insert new detection
                conn.execute("""
                    INSERT INTO detection_queue 
                    (detection_id, image_path, confidence, timestamp, latitude, longitude, metadata, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    detection_id,
                    image_path,
                    confidence,
                    timestamp,
                    latitude,
                    longitude,
                    json.dumps(metadata) if metadata else None,
                    datetime.utcnow().isoformat()
                ))
                conn.commit()
        
        print(f"📦 Queued detection {detection_id} (confidence: {confidence:.2f})")
        return detection_id
    
    def get_unsynced_detections(self, limit=10):
        """Get list of unsynced detections"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT * FROM detection_queue 
                WHERE synced = 0 
                ORDER BY created_at ASC 
                LIMIT ?
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]
    
    def mark_synced(self, detection_id):
        """Mark a detection as successfully synced"""
        with self.lock:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE detection_queue 
                    SET synced = 1 
                    WHERE detection_id = ?
                """, (detection_id,))
                conn.commit()
    
    def increment_upload_attempts(self, detection_id):
        """Increment upload attempt counter"""
        with self.lock:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE detection_queue 
                    SET upload_attempts = upload_attempts + 1 
                    WHERE detection_id = ?
                """, (detection_id,))
                conn.commit()
    
    def get_queue_stats(self):
        """Get queue statistics"""
        with sqlite3.connect(self.db_path) as conn:
            total = conn.execute("SELECT COUNT(*) FROM detection_queue").fetchone()[0]
            unsynced = conn.execute("SELECT COUNT(*) FROM detection_queue WHERE synced = 0").fetchone()[0]
            synced = total - unsynced
            return {
                "total": total,
                "unsynced": unsynced,
                "synced": synced,
                "queue_usage_percent": (unsynced / MAX_QUEUE_SIZE) * 100 if MAX_QUEUE_SIZE > 0 else 0
            }
    
    def cleanup_old_synced(self, days=7):
        """Remove old synced detections to free up space"""
        cutoff_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff_date = cutoff_date.replace(day=cutoff_date.day - days)
        
        with self.lock:
            with sqlite3.connect(self.db_path) as conn:
                deleted = conn.execute("""
                    DELETE FROM detection_queue 
                    WHERE synced = 1 AND created_at < ?
                """, (cutoff_date.isoformat(),)).rowcount
                conn.commit()
        
        if deleted > 0:
            print(f"🧹 Cleaned up {deleted} old synced detections")
        return deleted

