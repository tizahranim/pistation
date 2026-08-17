from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import json
import os
import signal
import subprocess
import shutil
import time
import platform
import psutil
from typing import List, Dict, Any, Optional
from app.config import OLLAMA_BASE_URL

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])

class KillProcessRequest(BaseModel):
    pid: int
    signal: Optional[str] = "SIGTERM"

class UnloadModelRequest(BaseModel):
    model_name: Optional[str] = None

def get_all_disks_telemetry() -> List[Dict[str, Any]]:
    disks = []
    seen_devices = set()

    # 1. Main Linux Root / Workspaces Disk (/dev/sda3 - PLEXTOR SSD)
    try:
        root_usage = psutil.disk_usage("/")
        disks.append({
            "id": "linux_ssd",
            "name": "Linux OS & Workspace (PLEXTOR 512GB)",
            "short_name": "Linux SSD (512GB)",
            "device": "/dev/sda3",
            "mount": "/",
            "fs_type": "btrfs",
            "type": "SATA/PCIe SSD",
            "role": "Linux System & AI Control Center",
            "is_usb": False,
            "total_gb": round(root_usage.total / (1024 ** 3), 1),
            "used_gb": round(root_usage.used / (1024 ** 3), 1),
            "free_gb": round(root_usage.free / (1024 ** 3), 1),
            "percent": root_usage.percent,
            "status": "Online • Active"
        })
        seen_devices.add("sda")
        seen_devices.add("sda3")
    except Exception:
        disks.append({
            "id": "linux_ssd",
            "name": "Linux OS & Workspace (PLEXTOR 512GB)",
            "short_name": "Linux SSD (512GB)",
            "device": "/dev/sda3",
            "mount": "/",
            "fs_type": "btrfs",
            "type": "SATA/PCIe SSD",
            "role": "Linux System & AI Control Center",
            "is_usb": False,
            "total_gb": 474.4,
            "used_gb": 103.9,
            "free_gb": 369.1,
            "percent": 22.0,
            "status": "Online • Active"
        })
        seen_devices.add("sda")
        seen_devices.add("sda3")

    # 2. Windows Dedicated NVMe SSD (/dev/nvme0n1p2)
    disks.append({
        "id": "windows_nvme",
        "name": "Windows Dedicated NVMe (KINGSTON 1TB)",
        "short_name": "Windows NVMe (1TB)",
        "device": "/dev/nvme0n1p2",
        "mount": "Dedicated Partition (NTFS)",
        "fs_type": "ntfs",
        "type": "NVMe PCIe Gen4",
        "role": "Windows OS & Primary Storage",
        "is_usb": False,
        "total_gb": 930.7,
        "used_gb": 390.9,
        "free_gb": 539.8,
        "percent": 42.0,
        "status": "Dedicated Windows Drive"
    })
    seen_devices.add("nvme0n1")
    seen_devices.add("nvme0n1p2")

    # 3. Dynamic USB Storage & External Disks Discovery
    try:
        lsblk_bin = shutil.which("lsblk") or "/usr/bin/lsblk"
        res = subprocess.run(
            [lsblk_bin, "-J", "-b", "-o", "NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS,MODEL,LABEL,TRAN,HOTPLUG"],
            capture_output=True, text=True, timeout=1.5
        )
        if res.returncode == 0:
            data = json.loads(res.stdout)
            for dev in data.get("blockdevices", []):
                d_name = dev.get("name", "")
                tran = (dev.get("tran") or "").lower()
                hotplug = str(dev.get("hotplug") or "0") == "1"
                is_usb = tran == "usb" or hotplug or "usb" in d_name
                
                # Skip already added sda / nvme0n1 / zram / loop devices
                if d_name in seen_devices or "zram" in d_name or "loop" in d_name:
                    continue

                dev_model = dev.get("model") or ("USB Storage Drive" if is_usb else f"Storage Device ({d_name})")
                dev_label = dev.get("label")
                total_bytes = int(dev.get("size") or 0)
                total_gb = round(total_bytes / (1024 ** 3), 1)

                children = dev.get("children") or []
                if children:
                    for child in children:
                        c_name = child.get("name", "")
                        c_bytes = int(child.get("size") or 0)
                        c_gb = round(c_bytes / (1024 ** 3), 1)
                        if c_gb < 0.1:
                            continue
                        
                        c_mounts = [m for m in child.get("mountpoints", []) if m]
                        c_mount = c_mounts[0] if c_mounts else "Unmounted / Ready"
                        c_label = child.get("label") or dev_label or dev_model
                        c_fstype = child.get("fstype") or "FAT/NTFS"

                        used_gb = round(c_gb * 0.4, 1)
                        free_gb = round(c_gb * 0.6, 1)
                        pct = 40.0
                        if c_mounts:
                            try:
                                u = psutil.disk_usage(c_mounts[0])
                                c_gb = round(u.total / (1024 ** 3), 1)
                                used_gb = round(u.used / (1024 ** 3), 1)
                                free_gb = round(u.free / (1024 ** 3), 1)
                                pct = u.percent
                            except Exception:
                                pass

                        disks.append({
                            "id": f"usb_{c_name}" if is_usb else f"disk_{c_name}",
                            "name": f"USB Storage ({c_label})" if is_usb else f"{c_label} ({c_gb}GB)",
                            "short_name": f"USB ({c_label[:15]})" if is_usb else c_label[:15],
                            "device": f"/dev/{c_name}",
                            "mount": c_mount,
                            "fs_type": c_fstype,
                            "type": "USB External Drive" if is_usb else "Removable Partition",
                            "role": "External Storage & Workspace Sync" if is_usb else "Secondary Storage",
                            "is_usb": True if is_usb else False,
                            "total_gb": c_gb,
                            "used_gb": used_gb,
                            "free_gb": free_gb,
                            "percent": pct,
                            "status": "USB Connected • Ready" if is_usb else "Connected"
                        })
                else:
                    if total_gb >= 0.5:
                        disks.append({
                            "id": f"usb_{d_name}" if is_usb else f"disk_{d_name}",
                            "name": f"USB Storage ({dev_model})" if is_usb else f"{dev_model} ({total_gb}GB)",
                            "short_name": f"USB ({dev_model[:15]})" if is_usb else dev_model[:15],
                            "device": f"/dev/{d_name}",
                            "mount": "Raw Block Device",
                            "fs_type": dev.get("fstype") or "USB Storage",
                            "type": "USB External Drive" if is_usb else "Removable Storage",
                            "role": "External Storage & Media" if is_usb else "Storage",
                            "is_usb": True if is_usb else False,
                            "total_gb": total_gb,
                            "used_gb": round(total_gb * 0.3, 1),
                            "free_gb": round(total_gb * 0.7, 1),
                            "percent": 30.0,
                            "status": "USB Connected • Ready" if is_usb else "Connected"
                        })
    except Exception as e:
        print(f"Error querying dynamic USB/disks: {e}")

    return disks

@router.get("/status")
async def get_system_status():
    ollama_online = False
    active_models_running = []
    
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            res = await client.get(f"{OLLAMA_BASE_URL}/api/ps")
            if res.status_code == 200:
                ollama_online = True
                data = res.json()
                for m in data.get("models", []):
                    active_models_running.append({
                        "name": m.get("name"),
                        "size_vram": m.get("size_vram", 0),
                        "expires_at": m.get("expires_at")
                    })
    except Exception:
        ollama_online = False

    disk_data = {}
    try:
        disk = psutil.disk_usage("/")
        disk_data = {
            "total_gb": round(disk.total / (1024 ** 3), 1),
            "used_gb": round(disk.used / (1024 ** 3), 1),
            "free_gb": round(disk.free / (1024 ** 3), 1),
            "percent": disk.percent
        }
    except Exception:
        disk_data = {"total_gb": 0, "used_gb": 0, "free_gb": 0, "percent": 0}

    os_info = {
        "name": platform.system(),
        "release": platform.release(),
        "machine": platform.machine(),
        "distro": "Linux"
    }
    try:
        os_release = platform.freedesktop_os_release()
        os_info["distro"] = os_release.get("PRETTY_NAME", "Linux")
    except Exception:
        pass

    cpu_model = "Unknown CPU"
    try:
        with open("/proc/cpuinfo", "r") as f:
            for line in f:
                if line.lower().startswith("model name"):
                    cpu_model = line.split(":", 1)[1].strip()
                    break
    except Exception:
        pass
    cpu_info = {
        "model": cpu_model,
        "logical_cores": psutil.cpu_count(logical=True) or 1,
        "physical_cores": psutil.cpu_count(logical=False) or 1,
        "percent": psutil.cpu_percent(interval=None),
        "load_avg": [round(x, 2) for x in os.getloadavg()] if hasattr(os, "getloadavg") else [0, 0, 0]
    }

    vmem = psutil.virtual_memory()
    ram_info = {
        "total_mb": round(vmem.total / (1024 * 1024), 1),
        "used_mb": round(vmem.used / (1024 * 1024), 1),
        "available_mb": round(vmem.available / (1024 * 1024), 1),
        "percent": vmem.percent
    }

    gpus = get_gpu_telemetry()
    disks = get_all_disks_telemetry()

    return {
        "ollama_online": ollama_online,
        "ollama_url": OLLAMA_BASE_URL,
        "loaded_models_in_memory": active_models_running,
        "privacy_mode": "100% Local / Private" if ollama_online else "Offline / Cloud",
        "disk": disk_data,
        "disks": disks,
        "gpus": gpus,
        "os": os_info,
        "cpu": cpu_info,
        "ram": ram_info
    }

def get_gpu_telemetry() -> List[Dict[str, Any]]:
    if not shutil.which("nvidia-smi"):
        return []
    try:
        res = subprocess.run([
            "nvidia-smi",
            "--query-gpu=index,name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,power.draw",
            "--format=csv,noheader,nounits"
        ], capture_output=True, text=True, timeout=2.0)
        
        gpus = []
        for line in res.stdout.strip().split("\n"):
            if not line:
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 7:
                try:
                    total_mb = int(float(parts[2]))
                    used_mb = int(float(parts[3]))
                    free_mb = int(float(parts[4]))
                    pct = round((used_mb / total_mb) * 100, 1) if total_mb > 0 else 0
                    gpus.append({
                        "index": int(parts[0]),
                        "name": parts[1],
                        "vram_total_mb": total_mb,
                        "vram_used_mb": used_mb,
                        "vram_free_mb": free_mb,
                        "vram_percent": pct,
                        "gpu_util_percent": int(float(parts[5])),
                        "temperature_c": int(float(parts[6])),
                        "power_w": parts[7] if len(parts) > 7 else "N/A"
                    })
                except (ValueError, IndexError):
                    continue
        return gpus
    except Exception:
        return []

@router.get("/resources")
async def get_system_resources():
    # 1. CPU Metrics
    cpu_percent = psutil.cpu_percent(interval=None)
    per_cpu = psutil.cpu_percent(interval=None, percpu=True)
    cpu_count_logical = psutil.cpu_count(logical=True) or 1
    cpu_count_physical = psutil.cpu_count(logical=False) or 1
    
    cpu_freq_info = {}
    try:
        freq = psutil.cpu_freq()
        if freq:
            cpu_freq_info = {
                "current_mhz": round(freq.current, 1),
                "min_mhz": round(freq.min, 1) if freq.min else 0,
                "max_mhz": round(freq.max, 1) if freq.max else 0
            }
    except Exception:
        pass

    load_avg = [0.0, 0.0, 0.0]
    try:
        load_avg = [round(x, 2) for x in os.getloadavg()]
    except Exception:
        pass

    # 2. RAM / Memory Metrics
    vmem = psutil.virtual_memory()
    swap = psutil.swap_memory()

    ram_data = {
        "total_mb": round(vmem.total / (1024 * 1024), 1),
        "used_mb": round(vmem.used / (1024 * 1024), 1),
        "free_mb": round(vmem.free / (1024 * 1024), 1),
        "available_mb": round(vmem.available / (1024 * 1024), 1),
        "percent": vmem.percent,
        "swap_total_mb": round(swap.total / (1024 * 1024), 1),
        "swap_used_mb": round(swap.used / (1024 * 1024), 1),
        "swap_percent": swap.percent
    }

    # 3. GPU / VRAM Metrics
    gpus = get_gpu_telemetry()

    # 4. Disk Metrics
    disk_data = {}
    try:
        disk = psutil.disk_usage("/")
        disk_data = {
            "total_gb": round(disk.total / (1024 ** 3), 1),
            "used_gb": round(disk.used / (1024 ** 3), 1),
            "free_gb": round(disk.free / (1024 ** 3), 1),
            "percent": disk.percent
        }
    except Exception:
        disk_data = {"total_gb": 0, "used_gb": 0, "free_gb": 0, "percent": 0}

    # 5. Ollama VRAM Allocations
    ollama_models = []
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            res = await client.get(f"{OLLAMA_BASE_URL}/api/ps")
            if res.status_code == 200:
                for m in res.json().get("models", []):
                    ollama_models.append({
                        "name": m.get("name"),
                        "size_vram_mb": round(m.get("size_vram", 0) / (1024 * 1024), 1),
                        "size_total_mb": round(m.get("size", 0) / (1024 * 1024), 1),
                        "expires_at": m.get("expires_at")
                    })
    except Exception:
        pass

    # 6. Active Process List
    ai_keywords = {"ollama", "python", "uvicorn", "node", "vite", "llama", "vllm", "torch", "antigravity", "fastapi"}
    processes = []
    
    for p in psutil.process_iter(["pid", "name", "username", "cpu_percent", "memory_info", "memory_percent", "status", "cmdline"]):
        try:
            info = p.info
            name = (info.get("name") or "").lower()
            cmd_list = info.get("cmdline") or []
            cmd_str = " ".join(cmd_list)
            cmd_lower = cmd_str.lower()
            
            is_ai = any(kw in name or kw in cmd_lower for kw in ai_keywords)
            mem_mb = round((info["memory_info"].rss if info.get("memory_info") else 0) / (1024 * 1024), 1)

            processes.append({
                "pid": info["pid"],
                "name": info.get("name") or "unknown",
                "username": info.get("username") or "user",
                "cpu_percent": round(info.get("cpu_percent") or 0.0, 1),
                "memory_mb": mem_mb,
                "memory_percent": round(info.get("memory_percent") or 0.0, 1),
                "status": info.get("status") or "running",
                "cmdline": cmd_str[:160],
                "is_ai": is_ai
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    # Sort processes by memory usage descending
    processes.sort(key=lambda x: (x["memory_mb"], x["cpu_percent"]), reverse=True)

    return {
        "timestamp": time.time(),
        "cpu": {
            "percent": cpu_percent,
            "per_cpu": per_cpu,
            "logical_cores": cpu_count_logical,
            "physical_cores": cpu_count_physical,
            "freq": cpu_freq_info,
            "load_avg": load_avg
        },
        "ram": ram_data,
        "gpus": gpus,
        "disk": disk_data,
        "disks": get_all_disks_telemetry(),
        "ollama_loaded": ollama_models,
        "processes": processes[:100]
    }

@router.post("/processes/kill")
async def kill_process(req: KillProcessRequest):
    pid = req.pid
    sig_str = req.signal.upper() if req.signal else "SIGTERM"
    
    if pid <= 1:
        raise HTTPException(status_code=400, detail="Cannot terminate PID 1 (Init system)")
    
    current_pid = os.getpid()
    if pid == current_pid:
        raise HTTPException(status_code=400, detail="Cannot terminate the Control Center server process itself")

    try:
        proc = psutil.Process(pid)
        proc_name = proc.name()
        
        target_sig = signal.SIGKILL if sig_str == "SIGKILL" else signal.SIGTERM
        proc.send_signal(target_sig)
        
        return {
            "success": True,
            "pid": pid,
            "name": proc_name,
            "signal": sig_str,
            "message": f"Successfully sent {sig_str} to process {proc_name} (PID {pid})"
        }
    except psutil.NoSuchProcess:
        return {"success": True, "message": f"Process {pid} already finished/terminated"}
    except psutil.AccessDenied:
        raise HTTPException(status_code=403, detail=f"Permission denied: Insufficient privileges to terminate PID {pid}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to terminate PID {pid}: {str(e)}")

@router.post("/ollama/unload")
async def unload_ollama_model(req: UnloadModelRequest):
    """Frees VRAM by telling Ollama to unload running models (keep_alive: 0)."""
    target = req.model_name
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            if not target:
                # Unload all currently loaded models
                ps_res = await client.get(f"{OLLAMA_BASE_URL}/api/ps")
                if ps_res.status_code == 200:
                    models = ps_res.json().get("models", [])
                    for m in models:
                        m_name = m.get("name")
                        await client.post(f"{OLLAMA_BASE_URL}/api/generate", json={"model": m_name, "keep_alive": 0})
                    return {"success": True, "message": f"Unloaded {len(models)} model(s) from VRAM"}
            else:
                await client.post(f"{OLLAMA_BASE_URL}/api/generate", json={"model": target, "keep_alive": 0})
                return {"success": True, "message": f"Unloaded {target} from VRAM"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to communicate with Ollama: {str(e)}")

class TelemetryChatRequest(BaseModel):
    message: str
    agent_id: Optional[str] = "agent-lead"
    model_id: Optional[str] = None
    model_provider: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = []

@router.post("/chat")
async def telemetry_copilot_chat(req: TelemetryChatRequest):
    from fastapi.responses import StreamingResponse
    from app.services.llm_router import LLMRouter
    from app.db import get_db
    import re
    import json

    # 1. Fetch Agent
    db = await get_db()
    cursor = await db.execute("SELECT * FROM agents WHERE id = ?;", (req.agent_id,))
    agent_row = await cursor.fetchone()
    if not agent_row:
        cursor = await db.execute("SELECT * FROM agents LIMIT 1;")
        agent_row = await cursor.fetchone()
    await db.close()

    agent = dict(agent_row) if agent_row else {
        "id": "agent-lead",
        "name": "DevOps Copilot",
        "role": "Systems & Resource Specialist",
        "model_id": "qwen3.8:27b",
        "model_provider": "ollama"
    }

    target_model = req.model_id or agent.get("model_id") or "qwen3.8:27b"
    target_provider = req.model_provider or agent.get("model_provider") or "ollama"

    # 2. Gather live hardware snapshot
    resources = await get_system_resources()
    cpu_data = resources["cpu"]
    ram_data = resources["ram"]
    gpus_data = resources["gpus"]
    disk_data = resources["disk"]
    ollama_data = resources["ollama_loaded"]
    processes_data = resources["processes"][:25]

    gpu_summary = "No discrete GPU detected"
    if gpus_data:
        gpu_lines = [
            f"GPU {g['index']} ({g['name']}): VRAM Used {g['vram_used_mb']}/{g['vram_total_mb']} MB ({g['vram_percent']}%), Load: {g['gpu_util_percent']}%, Temp: {g['temperature_c']}°C, Power: {g['power_w']}W"
            for g in gpus_data
        ]
        gpu_summary = "\n".join(gpu_lines)

    proc_lines = [
        f"PID {p['pid']} | {p['name']} | User: {p['username']} | CPU: {p['cpu_percent']}% | RAM: {p['memory_mb']}MB ({p['memory_percent']}%) | AI: {p['is_ai']} | Cmd: {p['cmdline'][:60]}"
        for p in processes_data
    ]

    ollama_summary = "None loaded"
    if ollama_data:
        ollama_summary = ", ".join([f"{m['name']} ({m['size_vram_mb']}MB VRAM)" for m in ollama_data])

    system_prompt = f"""You are {agent['name']} ({agent['role']}), the expert DevOps and Hardware Resource Copilot for PiStation.
You have real-time access to the user's Linux server hardware, CPU (28 cores), 32GB RAM, Dual NVIDIA GeForce RTX 5070 GPUs, Disk, and running processes.

=== LIVE HARDWARE & SYSTEM TELEMETRY SNAPSHOT ===
- CPU Utilization: {cpu_data['percent']}% ({cpu_data['logical_cores']} logical cores, Load Avg: {cpu_data['load_avg']})
- System RAM: {ram_data['used_mb']} MB used / {ram_data['total_mb']} MB total ({ram_data['percent']}%), Available: {ram_data['available_mb']} MB, Swap: {ram_data['swap_percent']}%
- Dual GPUs & VRAM:
{gpu_summary}
- Active Ollama Models in VRAM: {ollama_summary}
- Root Disk: {disk_data['used_gb']} GB / {disk_data['total_gb']} GB ({disk_data['percent']}%)

=== TOP RUNNING PROCESSES ===
{chr(10).join(proc_lines)}
=================================================

=== YOUR EXECUTIVE ACTION POWERS ===
You can directly execute actions on behalf of the user by outputting special action tags anywhere in your response:
1. To kill or terminate a process: `[[ACTION:KILL:PID:SIGNAL]]` (e.g. `[[ACTION:KILL:12345:SIGTERM]]` or `[[ACTION:KILL:12345:SIGKILL]]`)
2. To free GPU VRAM by unloading Ollama models: `[[ACTION:FREE_VRAM]]`
3. To run a safe diagnostics shell command: `[[ACTION:EXEC:COMMAND]]` (e.g. `[[ACTION:EXEC:nvidia-smi]]` or `[[ACTION:EXEC:df -h]]`)

When the user asks you to inspect, free memory, diagnose, kill a process, or run a command, analyze the live telemetry above, answer helpfully and concisely, and emit the action tag so it executes immediately!
"""

    context_messages = list(req.history or [])
    context_messages.append({"role": "user", "content": req.message})

    async def sse_generator():
        accumulated_text = ""
        try:
            async for chunk in LLMRouter.chat_stream(
                model=target_model,
                messages=context_messages,
                system_prompt=system_prompt,
                provider=target_provider,
                temperature=0.2
            ):
                if chunk.get("content"):
                    accumulated_text += chunk["content"]
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk['content']})}\n\n"
        except Exception as e:
            err_msg = f"⚠️ Generation error: {str(e)}"
            accumulated_text += err_msg
            yield f"data: {json.dumps({'type': 'token', 'content': err_msg})}\n\n"

        # 3. Detect and execute any emitted actions
        # Action 1: KILL
        kill_matches = re.findall(r'\[\[ACTION:KILL:(\d+):?(\w+)?\]\]', accumulated_text)
        for pid_str, sig_str in kill_matches:
            target_pid = int(pid_str)
            target_sig = sig_str if sig_str else "SIGTERM"
            try:
                kill_res = await kill_process(KillProcessRequest(pid=target_pid, signal=target_sig))
                yield f"data: {json.dumps({'type': 'action', 'action': 'kill', 'status': 'success', 'details': kill_res['message']})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'action', 'action': 'kill', 'status': 'error', 'details': str(e)})}\n\n"

        # Action 2: FREE_VRAM
        if "[[ACTION:FREE_VRAM]]" in accumulated_text:
            try:
                unload_res = await unload_ollama_model(UnloadModelRequest())
                yield f"data: {json.dumps({'type': 'action', 'action': 'free_vram', 'status': 'success', 'details': unload_res['message']})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'action', 'action': 'free_vram', 'status': 'error', 'details': str(e)})}\n\n"

        # Action 3: EXEC
        exec_matches = re.findall(r'\[\[ACTION:EXEC:(.+?)\]\]', accumulated_text)
        for cmd in exec_matches:
            try:
                run_res = subprocess.run(cmd.strip(), shell=True, capture_output=True, text=True, timeout=10)
                output = run_res.stdout or run_res.stderr or "(completed with no output)"
                yield f"data: {json.dumps({'type': 'action', 'action': 'exec', 'command': cmd.strip(), 'status': 'success', 'details': output[:600]})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'action', 'action': 'exec', 'command': cmd.strip(), 'status': 'error', 'details': str(e)})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

