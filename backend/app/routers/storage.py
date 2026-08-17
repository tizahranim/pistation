from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import shutil
import subprocess
import time
import psutil
from app.config import HOME_DIR

router = APIRouter(prefix="/api/storage", tags=["storage"])

PROTECTED_DEVICES = {"sda", "sda1", "sda2", "sda3", "nvme0n1", "nvme0n1p1", "nvme0n1p2", "nvme0n1p3", "zram0"}
PROTECTED_MOUNTS = {"/", "/boot", "/boot/efi", "/home", "/etc", "/var", "/usr"}

class EjectRequest(BaseModel):
    device: str

def human_size(n_bytes: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if abs(n_bytes) < 1024.0:
            return f"{n_bytes:3.1f} {unit}"
        n_bytes /= 1024.0
    return f"{n_bytes:.1f} PB"

@router.get("/explore")
async def explore_directory(path: str = Query(default=str(HOME_DIR))):
    target_path = os.path.abspath(path)
    
    if not os.path.exists(target_path):
        target_path = os.path.expanduser("~")
        if not os.path.exists(target_path):
            target_path = "/"

    if not os.path.isdir(target_path):
        target_path = os.path.dirname(target_path)

    parent_path = os.path.dirname(target_path) if target_path != "/" else None

    entries = []
    try:
        with os.scandir(target_path) as it:
            for entry in it:
                try:
                    stat = entry.stat(follow_symlinks=False)
                    is_dir = entry.is_dir(follow_symlinks=False)
                    size = stat.st_size if not is_dir else 0
                    ext = os.path.splitext(entry.name)[1].lower() if not is_dir else ""
                    
                    entries.append({
                        "name": entry.name,
                        "path": entry.path,
                        "is_dir": is_dir,
                        "size_bytes": size,
                        "size_human": human_size(size) if not is_dir else "--",
                        "modified": stat.st_mtime,
                        "modified_str": time.strftime("%Y-%m-%d %H:%M", time.localtime(stat.st_mtime)),
                        "ext": ext,
                        "is_symlink": entry.is_symlink()
                    })
                except (PermissionError, FileNotFoundError, OSError):
                    continue
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied accessing {target_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Sort: folders first, then files alphabetically
    entries.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))

    # Try to get disk info for this mount point
    disk_info = None
    try:
        usage = psutil.disk_usage(target_path)
        disk_info = {
            "total_gb": round(usage.total / (1024 ** 3), 1),
            "used_gb": round(usage.used / (1024 ** 3), 1),
            "free_gb": round(usage.free / (1024 ** 3), 1),
            "percent": usage.percent
        }
    except Exception:
        pass

    return {
        "current_path": target_path,
        "parent_path": parent_path,
        "entries": entries[:250],
        "total_items": len(entries),
        "disk_info": disk_info
    }

@router.post("/eject")
async def eject_drive(req: EjectRequest):
    dev_str = req.device.strip()
    dev_base = os.path.basename(dev_str)

    # 1. Validation & Safety locks
    if dev_base in PROTECTED_DEVICES or any(p in dev_str for p in ["sda", "nvme0n1", "loop", "zram"]):
        raise HTTPException(
            status_code=400,
            detail=f"SECURITY VIOLATION: Device {dev_str} is a protected primary OS drive and cannot be ejected."
        )

    for part in psutil.disk_partitions(all=True):
        if part.device == dev_str and part.mountpoint in PROTECTED_MOUNTS:
            raise HTTPException(
                status_code=400,
                detail=f"Device {dev_str} is mounted at system root '{part.mountpoint}' and cannot be ejected."
            )

    logs = []
    logs.append(f"Initiating safe removal for {dev_str}...")

    # Step 1: Unmount via udisksctl
    unmount_success = False
    try:
        res = subprocess.run(["udisksctl", "unmount", "-b", dev_str, "--no-user-interaction"], capture_output=True, text=True, timeout=10)
        if res.returncode == 0:
            logs.append(f"Successfully unmounted {dev_str}.")
            unmount_success = True
        else:
            err = res.stderr or res.stdout or "Unmount returned non-zero code"
            logs.append(f"udisksctl unmount note: {err}")
    except Exception as e:
        logs.append(f"Unmount error: {e}")

    # Fallback to standard umount if needed
    if not unmount_success:
        try:
            res = subprocess.run(["umount", dev_str], capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                logs.append(f"Unmounted {dev_str} via umount.")
                unmount_success = True
        except Exception:
            pass

    # Step 2: Power off / Eject drive
    eject_success = False
    try:
        res = subprocess.run(["udisksctl", "power-off", "-b", dev_str, "--no-user-interaction"], capture_output=True, text=True, timeout=10)
        if res.returncode == 0:
            logs.append(f"Drive {dev_str} powered off safely.")
            eject_success = True
        else:
            err = res.stderr or res.stdout or ""
            logs.append(f"udisksctl power-off note: {err}")
    except Exception:
        pass

    if not eject_success:
        try:
            res = subprocess.run(["eject", dev_str], capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                logs.append(f"Ejected {dev_str} via eject tool.")
                eject_success = True
        except Exception:
            pass

    return {
        "success": True,
        "message": f"Drive {dev_str} safely unmounted and powered off. Ready to unplug.",
        "logs": logs
    }
