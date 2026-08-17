import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Cpu,
  Globe,
  Award,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  TrendingUp,
  Send,
  Loader2,
  FileCode,
  Swords,
  ChevronRight,
  HelpCircle,
  Upload,
  Check,
  Zap,
  ArrowRight,
  Search,
  ClipboardPaste,
  ChevronDown,
  X,
  ExternalLink,
  Layers,
  Activity,
  Edit3,
  Save,
  Wand2,
  Paperclip,
  Database
} from 'lucide-react';

export default function FineTuningStudio({ models, agents = [], activeModel }) {
  // Modes: 'wizard' (Auto based on weakness), 'manual' (Custom + Attach Dataset), 'datasets' (Dataset Hub), 'arena' (Testing Arena)
  const [activeTab, setActiveTab] = useState('wizard');
  
  // Helpers for dynamic model naming
  const getCleanBaseName = (modelId) => {
    if (!modelId) return 'AI Model';
    const raw = modelId.split(':')[0];
    return raw
      .replace(/([a-zA-Z]+)(\d+)/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const getCleanTagPrefix = (modelId) => {
    if (!modelId) return 'custom-model';
    return modelId.split(':')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
  };

  // Initial student model from Ollama
  const defaultTrainee = models?.ollama_models?.[0]?.id || 'qwen3.8:27b';

  // Pipelines state
  const [jobs, setJobs] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Active Creation / Edit Form State
  const [jobName, setJobName] = useState(`${getCleanBaseName(defaultTrainee)} Domain Specialist`);
  const [trainerModel, setTrainerModel] = useState('deepseek/deepseek-chat');
  const [traineeModel, setTraineeModel] = useState(defaultTrainee);
  const [targetIdentifier, setTargetIdentifier] = useState(`${getCleanTagPrefix(defaultTrainee)}-custom:latest`);
  const [domainFocus, setDomainFocus] = useState('Linux Systems, High-Concurrency Python, and Cloud Architecture');
  const [selectedDatasetId, setSelectedDatasetId] = useState('');

  // Manual Tab Specific State
  const [manualModeDatasetSource, setManualModeDatasetSource] = useState('hub'); // 'hub' | 'generate'
  const [manualPromptTopic, setManualPromptTopic] = useState('');
  const [manualSampleCount, setManualSampleCount] = useState(10);

  // Teacher Model Catalog & Search Modal State
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [openrouterCatalog, setOpenrouterCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [pastedModelInput, setPastedModelInput] = useState('');

  // Live Execution Progress State
  const [runningAction, setRunningAction] = useState(null);
  const [actionStatusText, setActionStatusText] = useState('');
  const [actionLogs, setActionLogs] = useState([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);

  // Notice
  const [notice, setNotice] = useState(null);
  const [showBenchmarkDetails, setShowBenchmarkDetails] = useState(false);

  // LoRA Training Configuration & Telemetry State
  const [trainingEngine, setTrainingEngine] = useState('lora'); // 'lora' | 'distill'
  const [loraEpochs, setLoraEpochs] = useState(3);
  const [loraRank, setLoraRank] = useState(16);
  const [loraLearningRate, setLoraLearningRate] = useState(0.0002);
  const [loraQuant, setLoraQuant] = useState('4bit');
  const [trainingTelemetry, setTrainingTelemetry] = useState(null);
  const [showAdvancedLoRA, setShowAdvancedLoRA] = useState(false);

  // Datasets Hub State
  const [datasets, setDatasets] = useState([]);
  const [activeHubDataset, setActiveHubDataset] = useState(null);
  const [isEditingDataset, setIsEditingDataset] = useState(false);
  const [editingDatasetData, setEditingDatasetData] = useState([]);
  const [editingDatasetName, setEditingDatasetName] = useState('');
  const [isSynthesizingInHub, setIsSynthesizingInHub] = useState(false);
  const [hubSynthTopic, setHubSynthTopic] = useState('');
  const [hubSynthCount, setHubSynthCount] = useState(8);
  const [hubSynthDifficulty, setHubSynthDifficulty] = useState('expert');
  const [hubSynthName, setHubSynthName] = useState('');
  const fileInputRef = useRef(null);

  // Arena testing state
  const [arenaPrompt, setArenaPrompt] = useState('Write a high-performance Python script to monitor system memory and handle edge-case memory spikes.');
  const [arenaBaseModel, setArenaBaseModel] = useState(models?.ollama_models?.[0]?.id || 'qwen3.8:27b');
  const [arenaFinetunedModel, setArenaFinetunedModel] = useState('');
  const [arenaBaseOutput, setArenaBaseOutput] = useState('');
  const [arenaFinetunedOutput, setArenaFinetunedOutput] = useState('');
  const [isArenaStreaming, setIsArenaStreaming] = useState(false);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/finetuning/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
        if (data.length > 0) {
          if (!activeJobId) {
            setActiveJobId(data[0].id);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load jobs:', e);
    }
  };

  const fetchDatasets = async () => {
    try {
      const res = await fetch('/api/finetuning/datasets');
      if (res.ok) {
        const data = await res.json();
        setDatasets(data);
        if (data.length > 0 && !activeHubDataset) {
          fetchDatasetDetails(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load datasets:', e);
    }
  };

  const fetchDatasetDetails = async (id) => {
    try {
      const res = await fetch(`/api/finetuning/datasets/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveHubDataset(data);
        setEditingDatasetData(data.data || []);
        setEditingDatasetName(data.name || '');
      }
    } catch (e) {
      console.error('Failed to fetch dataset details:', e);
    }
  };

  const fetchOpenRouterCatalog = async () => {
    setCatalogLoading(true);
    try {
      const res = await fetch('/api/models/openrouter/catalog');
      if (res.ok) {
        const data = await res.json();
        setOpenrouterCatalog(data.models || []);
      }
    } catch (e) {
      console.error('Failed to load OpenRouter catalog:', e);
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchDatasets();
    fetchOpenRouterCatalog();
  }, []);

  // Timer handling for live progress
  useEffect(() => {
    if (runningAction) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(s => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [runningAction]);

  const currentJob = jobs.find(j => j.id === activeJobId) || jobs[0];

  const handleStartNewPipeline = (mode = 'wizard') => {
    setIsCreatingNew(true);
    const trainee = models?.ollama_models?.[0]?.id || 'qwen3.8:27b';
    const cleanName = getCleanBaseName(trainee);
    const tagPrefix = getCleanTagPrefix(trainee);
    setJobName(`${cleanName} Domain Specialist`);
    setDomainFocus('Linux Systems, High-Concurrency Python, and Cloud Architecture');
    setTargetIdentifier(`${tagPrefix}-custom:latest`);
    setTrainerModel('deepseek/deepseek-chat');
    setTraineeModel(trainee);
    setActiveTab(mode);
  };

  const handleSavePipeline = async (e) => {
    e?.preventDefault();
    if (!jobName.trim() || !domainFocus.trim() || !targetIdentifier.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/finetuning/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: jobName,
          trainer_model: trainerModel,
          trainee_model: traineeModel,
          target_identifier: targetIdentifier,
          dataset_id: selectedDatasetId || null,
          domain_focus: domainFocus
        })
      });
      if (res.ok) {
        const data = await res.json();
        setNotice({ type: 'success', text: `Custom Model "${data.name}" created! Starting Auto Wizard...` });
        await fetchJobs();
        setActiveJobId(data.id);
        setIsCreatingNew(false);
        // Automatically start the continuous 4-step Auto Wizard
        handleRunFullAutoPipeline(data.id);
      }
    } catch (err) {
      setNotice({ type: 'error', text: `Failed to save pipeline: ${err.message}` });
    } finally {
      setLoading(false);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleDeleteJob = async (jobId, jobName) => {
    if (!window.confirm(`Are you sure you want to delete "${jobName || 'this custom model'}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/finetuning/jobs/${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        setNotice({ type: 'success', text: `Deleted "${jobName || 'custom model'}"` });
        const remaining = jobs.filter(j => j.id !== jobId);
        setJobs(remaining);
        if (remaining.length > 0) {
          setActiveJobId(remaining[0].id);
          setIsCreatingNew(false);
        } else {
          setActiveJobId(null);
          setIsCreatingNew(true);
        }
      } else {
        const data = await res.json();
        setNotice({ type: 'error', text: data.detail || 'Failed to delete custom model' });
      }
    } catch (err) {
      setNotice({ type: 'error', text: `Delete error: ${err.message}` });
    } finally {
      setTimeout(() => setNotice(null), 3000);
    }
  };

  const handleIterateOnModel = (job) => {
    if (!job) return;
    setIsCreatingNew(true);
    setTraineeModel(job.target_identifier);
    const baseName = (job.name || 'Custom Model').replace(/\s*v\d+$/i, '');
    setJobName(`${baseName} v2`);
    const cleanTag = (job.target_identifier || 'custom-model').split(':')[0].replace(/-v\d+$/i, '');
    setTargetIdentifier(`${cleanTag}-v2:latest`);
    setDomainFocus(job.domain_focus || '');
    setNotice({ type: 'info', text: `Loaded "${job.target_identifier}" as base model for iterative fine-tuning!` });
    setTimeout(() => setNotice(null), 4000);
  };

  // 1. Run Pre-Evaluation Promise Runner
  const runPreEvalPromise = async (jobId) => {
    setActionStatusText('Step 1/4: Running Baseline Capability Assessment...');
    setActionLogs(prev => [...prev, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '▶ STEP 1/4: BASELINE CAPABILITY ASSESSMENT (Testing base model...)']);
    
    const res = await fetch(`/api/finetuning/jobs/${jobId}/evaluate-pre-stream`, { method: 'POST' });
    if (!res.ok) throw new Error(`Pre-eval HTTP error ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'log') {
              setActionStatusText(event.text);
              setActionLogs(prev => [...prev, event.text]);
            } else if (event.type === 'error') {
              throw new Error(event.text);
            }
          } catch (e) {
            if (e.message && !e.message.startsWith('Unexpected')) throw e;
          }
        }
      }
    }
  };

  // 2. Synthesize Dataset Promise Runner
  const runSynthesizePromise = async (jobId) => {
    setActionStatusText('Step 2/4: Synthesizing Weakness-Targeted Training Pairs...');
    setActionLogs(prev => [...prev, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '▶ STEP 2/4: TARGETED DATASET SYNTHESIS (Synthesizing domain pairs...)']);
    
    const res = await fetch(`/api/finetuning/jobs/${jobId}/synthesize-dataset-stream`, { method: 'POST' });
    if (!res.ok) throw new Error(`Synthesize HTTP error ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'log') {
              setActionStatusText(event.text);
              setActionLogs(prev => [...prev, event.text]);
            } else if (event.type === 'error') {
              throw new Error(event.text);
            }
          } catch (e) {
            if (e.message && !e.message.startsWith('Unexpected')) throw e;
          }
        }
      }
    }
  };

  // 3. Unsloth QLoRA Training Promise Runner
  const runLoraTrainingPromise = async (jobId) => {
    setActionStatusText('Step 3/4: Training Model with Unsloth QLoRA on Dual RTX 5070s...');
    setActionLogs(prev => [...prev, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '▶ STEP 3/4: UNSLOTH QLORA TRAINING (Dual NVIDIA RTX 5070 GPUs - 24GB VRAM)']);
    setTrainingTelemetry(null);

    const res = await fetch(`/api/finetuning/jobs/${jobId}/train-lora-stream?epochs=${loraEpochs}&lr=${loraLearningRate}&lora_rank=${loraRank}&quant=${loraQuant}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`Training HTTP error ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'log') {
              setActionStatusText(event.text);
              setActionLogs(prev => [...prev, event.text]);
            } else if (event.type === 'telemetry') {
              setTrainingTelemetry(event);
              setActionStatusText(`Epoch ${event.epoch}/${event.total_epochs} (Step ${event.step}/${event.total_steps}) - Loss: ${event.loss.toFixed(4)}`);
            } else if (event.type === 'error') {
              throw new Error(event.text);
            }
          } catch (e) {
            if (e.message && !e.message.startsWith('Unexpected')) throw e;
          }
        }
      }
    }
  };

  // 4. Post-Eval Promise Runner
  const runPostEvalPromise = async (jobId) => {
    setActionStatusText('Step 4/4: Benchmarking Fine-Tuned Model & Calculating Improvement Matrix...');
    setActionLogs(prev => [...prev, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '▶ STEP 4/4: POST-EVALUATION SCORECARD (Comparative Judging)']);

    const res = await fetch(`/api/finetuning/jobs/${jobId}/evaluate-post-stream`, { method: 'POST' });
    if (!res.ok) throw new Error(`Post-eval HTTP error ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'log') {
              setActionStatusText(event.text);
              setActionLogs(prev => [...prev, event.text]);
            } else if (event.type === 'error') {
              throw new Error(event.text);
            }
          } catch (e) {
            if (e.message && !e.message.startsWith('Unexpected')) throw e;
          }
        }
      }
    }
  };

  // Autonomous Full 4-Step Pipeline Execution Handler
  const handleRunFullAutoPipeline = async (targetJobId) => {
    const jId = targetJobId || currentJob?.id;
    if (!jId || runningAction) return;

    setRunningAction('auto_wizard');
    setActionLogs(['🚀 Starting Full Autonomous Fine-Tuning Wizard (Continuous Steps 1 ➔ 4)...']);

    try {
      // Step 1: Baseline Assessment
      await runPreEvalPromise(jId);
      await fetchJobs();

      // Step 2: Targeted Dataset Synthesis
      await runSynthesizePromise(jId);
      await fetchJobs();
      await fetchDatasets();

      // Step 3: Unsloth QLoRA Training
      await runLoraTrainingPromise(jId);
      await fetchJobs();

      // Step 4: Post-Evaluation
      await runPostEvalPromise(jId);
      await fetchJobs();

      setNotice({ type: 'success', text: '🎉 Auto Wizard Complete! All 4 steps finished automatically.' });
    } catch (err) {
      setNotice({ type: 'error', text: `Auto Wizard error: ${err.message}` });
    } finally {
      setRunningAction(null);
      setTimeout(() => setNotice(null), 5000);
    }
  };

  // Individual Step Triggers for Manual Re-runs
  const handlePreEval = async () => {
    if (!currentJob || runningAction) return;
    setRunningAction('pre_eval');
    try {
      await runPreEvalPromise(currentJob.id);
      await fetchJobs();
      setNotice({ type: 'success', text: 'Baseline capability evaluation completed!' });
    } catch (err) {
      setNotice({ type: 'error', text: `Evaluation error: ${err.message}` });
    } finally {
      setRunningAction(null);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleSynthesizeDataset = async () => {
    if (!currentJob || runningAction) return;
    setRunningAction('synthesize');
    try {
      await runSynthesizePromise(currentJob.id);
      await fetchJobs();
      await fetchDatasets();
      setNotice({ type: 'success', text: 'Synthesized & attached training pairs to model!' });
    } catch (err) {
      setNotice({ type: 'error', text: `Dataset synthesis error: ${err.message}` });
    } finally {
      setRunningAction(null);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleRunLoraTraining = async () => {
    if (!currentJob || runningAction) return;
    setRunningAction('training_lora');
    try {
      await runLoraTrainingPromise(currentJob.id);
      await fetchJobs();
      setNotice({ type: 'success', text: 'Unsloth QLoRA Training Complete!' });
    } catch (err) {
      setNotice({ type: 'error', text: `Training error: ${err.message}` });
    } finally {
      setRunningAction(null);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handlePostEval = async () => {
    if (!currentJob || runningAction) return;
    setRunningAction('post_eval');
    try {
      await runPostEvalPromise(currentJob.id);
      await fetchJobs();
      setNotice({ type: 'success', text: 'Post-training evaluation scorecard generated!' });
    } catch (err) {
      setNotice({ type: 'error', text: `Post-eval error: ${err.message}` });
    } finally {
      setRunningAction(null);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleCompileAndRegister = async () => {
    if (runningAction || !selectedDatasetId) return;

    let targetJobId = currentJob?.id;

    // Check if we need to create/save the job first
    if (!targetJobId || isCreatingNew || currentJob?.trainee_model !== traineeModel || currentJob?.target_identifier !== targetIdentifier) {
      setLoading(true);
      try {
        const res = await fetch('/api/finetuning/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: jobName.trim() || `${getCleanBaseName(traineeModel)} Custom Expert`,
            trainer_model: trainerModel,
            trainee_model: traineeModel,
            target_identifier: targetIdentifier.trim() || `${getCleanTagPrefix(traineeModel)}-custom:latest`,
            dataset_id: selectedDatasetId,
            domain_focus: jobName.trim()
          })
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const newJob = await res.json();
        targetJobId = newJob.id;
        await fetchJobs();
        setActiveJobId(newJob.id);
        setIsCreatingNew(false);
      } catch (err) {
        setNotice({ type: 'error', text: `Failed to initialize model: ${err.message}` });
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    setRunningAction('training_lora');
    try {
      await runLoraTrainingPromise(targetJobId);
      await fetchJobs();
      setNotice({ type: 'success', text: '🎉 Unsloth QLoRA Training Complete! Model registered in Ollama.' });
    } catch (err) {
      setNotice({ type: 'error', text: `Training error: ${err.message}` });
    } finally {
      setRunningAction(null);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleTrainOrCompile = () => {
    handleRunLoraTraining();
  };

  // Manual Tab: Synthesize & Attach Dataset
  const handleManualSynthesizeAndAttach = async () => {
    if (!manualPromptTopic.trim() || runningAction) return;
    setRunningAction('manual_synthesize');
    setActionStatusText('Synthesizing custom dataset for manual fine-tuning...');
    setActionLogs(['Generating targeted training pairs via Teacher AI...']);

    try {
      const res = await fetch('/api/finetuning/datasets/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_model: trainerModel,
          topic: manualPromptTopic,
          sample_count: manualSampleCount,
          difficulty: 'expert'
        })
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'log') {
                setActionStatusText(event.text);
                setActionLogs(prev => [...prev, event.text]);
              } else if (event.type === 'done' && event.samples) {
                const saveRes = await fetch('/api/finetuning/datasets', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: `${jobName} Dataset`,
                    description: `Synthesized on request: ${manualPromptTopic}`,
                    data: event.samples
                  })
                });
                const savedDs = await saveRes.json();
                await fetchDatasets();
                setSelectedDatasetId(savedDs.id);
                setNotice({ type: 'success', text: `Synthesized & attached dataset "${savedDs.name}"!` });
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      setNotice({ type: 'error', text: `Synthesis error: ${err.message}` });
    } finally {
      setRunningAction(null);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  // Dataset Hub: Ask AI to Generate Dataset
  const handleHubGenerateDataset = async () => {
    if (!hubSynthTopic.trim() || isSynthesizingInHub) return;
    setIsSynthesizingInHub(true);
    setNotice({ type: 'success', text: 'Teacher AI is synthesizing your dataset...' });

    try {
      const res = await fetch('/api/finetuning/datasets/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_model: trainerModel,
          topic: hubSynthTopic,
          sample_count: hubSynthCount,
          difficulty: hubSynthDifficulty
        })
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'done' && event.samples) {
                const finalName = hubSynthName.trim() || `Dataset - ${hubSynthTopic.slice(0, 25)}`;
                const saveRes = await fetch('/api/finetuning/datasets', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: finalName,
                    description: `Synthesized with ${trainerModel} (${hubSynthDifficulty})`,
                    data: event.samples
                  })
                });
                const savedDs = await saveRes.json();
                await fetchDatasets();
                fetchDatasetDetails(savedDs.id);
                setHubSynthTopic('');
                setHubSynthName('');
                setNotice({ type: 'success', text: `Successfully generated and saved "${finalName}" into Hub!` });
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      setNotice({ type: 'error', text: `Synthesis error: ${err.message}` });
    } finally {
      setIsSynthesizingInHub(false);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  // Dataset Hub: Save / Update Dataset Changes
  const handleSaveDatasetEdits = async () => {
    if (!activeHubDataset) return;
    try {
      const res = await fetch(`/api/finetuning/datasets/${activeHubDataset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingDatasetName,
          description: activeHubDataset.description,
          format: activeHubDataset.format || 'alpaca',
          data: editingDatasetData
        })
      });
      if (res.ok) {
        setNotice({ type: 'success', text: 'Dataset updated successfully!' });
        setIsEditingDataset(false);
        await fetchDatasets();
        fetchDatasetDetails(activeHubDataset.id);
      }
    } catch (err) {
      setNotice({ type: 'error', text: `Update error: ${err.message}` });
    }
  };

  // Dataset Hub: Delete Dataset
  const handleDeleteDataset = async (id) => {
    try {
      const res = await fetch(`/api/finetuning/datasets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotice({ type: 'success', text: 'Dataset removed from Hub.' });
        setActiveHubDataset(null);
        await fetchDatasets();
      }
    } catch (err) {
      setNotice({ type: 'error', text: `Delete error: ${err.message}` });
    }
  };

  // Dataset Hub: Upload File
  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/finetuning/datasets/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setNotice({ type: 'success', text: `Uploaded dataset "${data.name}" (${data.sample_count} pairs)!` });
        await fetchDatasets();
        fetchDatasetDetails(data.id);
      } else {
        setNotice({ type: 'error', text: data.detail || 'Upload failed' });
      }
    } catch (err) {
      setNotice({ type: 'error', text: `Upload error: ${err.message}` });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Pasting Model ID
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setPastedModelInput(text.trim());
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  const handleApplyPastedModel = () => {
    if (!pastedModelInput.trim()) return;
    setTrainerModel(pastedModelInput.trim());
    setIsTeacherModalOpen(false);
    setPastedModelInput('');
    setNotice({ type: 'success', text: `Selected Teacher: ${pastedModelInput.trim()}` });
    setTimeout(() => setNotice(null), 3000);
  };

  // Arena Comparison
  const handleRunArena = async () => {
    if (!arenaPrompt.trim() || isArenaStreaming) return;
    setIsArenaStreaming(true);
    setArenaBaseOutput('');
    setArenaFinetunedOutput('');

    const targetFinetuned = arenaFinetunedModel || currentJob?.target_identifier || 'qwen3.8:27b';

    try {
      const res = await fetch('/api/finetuning/arena/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_model: arenaBaseModel,
          finetuned_model: targetFinetuned,
          prompt: arenaPrompt
        })
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'token') {
                if (event.target === 'base') {
                  setArenaBaseOutput(prev => prev + event.content);
                } else if (event.target === 'finetuned') {
                  setArenaFinetunedOutput(prev => prev + event.content);
                }
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      setArenaBaseOutput(prev => prev + `\n⚠️ Error: ${err.message}`);
    } finally {
      setIsArenaStreaming(false);
    }
  };

  // Filtered Teacher Models Catalog (dynamically loaded)
  const topCuratedModels = [
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek-V3', provider: 'DeepSeek', badge: 'Recommended' },
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'Meta AI', badge: 'Ultra Capable' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', badge: 'High Reasoning' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', badge: 'Flagship' },
    { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro', provider: 'Google', badge: '1M Context' },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'Alibaba', badge: 'Open Weights' }
  ];

  const allAvailableTeacherModels = [
    ...topCuratedModels,
    ...openrouterCatalog.filter(om => !topCuratedModels.some(cm => cm.id === om.id))
  ];

  const filteredTeacherModels = allAvailableTeacherModels.filter(m => {
    const q = modelSearchQuery.toLowerCase();
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.id || '').toLowerCase().includes(q) ||
      (m.provider || '').toLowerCase().includes(q)
    );
  });

  const preEval = currentJob?.pre_eval || {};
  const postEval = currentJob?.post_eval || {};
  const hasPreEval = preEval && preEval.overall_score !== undefined;
  const hasPostEval = postEval && postEval.overall_score !== undefined;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0c13] text-gray-100 overflow-hidden font-sans select-none relative">
      
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-card-border bg-[#0d101a] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-sm shadow-sm">
            🎯
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-100 flex items-center gap-2">
              <span>Fine-Tuning Studio</span>
            </h1>
            <p className="text-xs text-gray-400">
              Distill specialized intelligence from frontier cloud AI into local models on your dual RTX 5070 GPUs.
            </p>
          </div>
        </div>

        {/* Top Controls & 4 Main Modes */}
        <div className="flex items-center gap-2.5">
          {notice && (
            <div className={`px-3 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 animate-in fade-in ${
              notice.type === 'success' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/15 text-red-300 border border-red-500/30'
            }`}>
              {notice.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              <span>{notice.text}</span>
            </div>
          )}

          <div className="flex items-center bg-[#151928] border border-card-border rounded-xl p-0.5 text-xs font-mono">
            {/* Mode 1: Auto Training (Weakness-Based) */}
            <button
              onClick={() => { setActiveTab('wizard'); setIsCreatingNew(true); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'wizard' ? 'bg-purple-600 text-white font-bold shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Automated training flow based on evaluated weaknesses"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Auto Training</span>
            </button>

            {/* Mode 2: Manual Training */}
            <button
              onClick={() => { setActiveTab('manual'); setIsCreatingNew(true); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'manual' ? 'bg-purple-600 text-white font-bold shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Manual training with attached datasets"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>Manual Training</span>
            </button>

            {/* Mode 3: Custom Dataset Hub */}
            <button
              onClick={() => setActiveTab('datasets')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'datasets' ? 'bg-purple-600 text-white font-bold shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
              title="View, edit, generate, and manage custom datasets"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Dataset Hub ({datasets.length})</span>
            </button>

            {/* Mode 4: Testing Arena */}
            <button
              onClick={() => setActiveTab('arena')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'arena' ? 'bg-purple-600 text-white font-bold shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Testing Arena</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sub-Sidebar (Visible for Wizard & Manual modes) */}
        {(activeTab === 'wizard' || activeTab === 'manual') && (
          <div className="w-64 border-r border-card-border bg-[#0d0f18] p-3 flex flex-col justify-between shrink-0 overflow-hidden">
            <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono flex items-center justify-between">
                <span>Custom Models</span>
                <span className="text-purple-400">({jobs.length})</span>
              </div>

              <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                {jobs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-500 font-mono">
                    No custom models yet. Click "New Fine-Tuning".
                  </div>
                ) : (
                  jobs.map(j => {
                    const isSelected = activeJobId === j.id && !isCreatingNew;
                    return (
                      <div
                        key={j.id}
                        onClick={() => {
                          setActiveJobId(j.id);
                          setIsCreatingNew(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl text-xs transition-all border cursor-pointer group ${
                          isSelected
                            ? 'bg-purple-600/20 border-purple-500/50 text-purple-200 shadow-sm'
                            : 'bg-[#131622] hover:bg-[#191d2c] border-card-border text-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold truncate text-gray-100 mr-1">{j.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteJob(j.id, j.name);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 p-0.5 rounded transition-all"
                            title="Delete model / draft"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-[10px] font-mono text-purple-300 truncate mt-0.5">
                          {j.target_identifier}
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-gray-500 font-mono mt-1.5 pt-1 border-t border-white/5">
                          <span className="capitalize">{j.status}</span>
                          <span>{new Date(j.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Right Content View */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* TAB 1: AUTO WIZARD (Weakness-Based) */}
          {activeTab === 'wizard' && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* If creating new pipeline */}
              {isCreatingNew ? (
                <div className="p-6 rounded-2xl bg-[#0f121e] border border-purple-500/40 space-y-5 shadow-2xl animate-in fade-in">
                  <div className="border-b border-card-border pb-3">
                    <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-purple-400" />
                      <span>Auto Training (Weakness-Driven)</span>
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Teacher AI evaluates local baseline weaknesses, generates fix data, and registers the fine-tuned model.
                    </p>
                  </div>

                  <form onSubmit={handleSavePipeline} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Teacher Model Card with Clean Search Trigger */}
                      <div className="p-4 rounded-xl bg-[#141828] border border-indigo-500/30 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-indigo-300 font-bold font-mono">
                            <Globe className="w-4 h-4" />
                            <span>1. Teacher Model (Cloud AI)</span>
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">OpenRouter</span>
                        </div>
                        
                        {/* Clean Search Trigger */}
                        <div
                          onClick={() => setIsTeacherModalOpen(true)}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-[#0e111d] border border-card-border cursor-pointer hover:border-indigo-500/50 transition-colors group"
                        >
                          <div className="truncate mr-2">
                            <div className="font-bold text-xs text-indigo-200 truncate">{trainerModel}</div>
                            <div className="text-[10px] text-gray-500 font-mono">Click to change or paste model ID</div>
                          </div>
                          <Search className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-300 shrink-0" />
                        </div>
                      </div>

                      {/* Student Model Card */}
                      <div className="p-4 rounded-xl bg-[#141828] border border-emerald-500/30 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-300 font-bold font-mono">
                            <Cpu className="w-4 h-4" />
                            <span>2. Student Model (Local Base)</span>
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">Local Ollama</span>
                        </div>
                        <select
                          value={traineeModel}
                          onChange={(e) => {
                            const newModel = e.target.value;
                            setTraineeModel(newModel);
                            const cleanName = getCleanBaseName(newModel);
                            const tagPrefix = getCleanTagPrefix(newModel);
                            setJobName(`${cleanName} Domain Specialist`);
                            setTargetIdentifier(`${tagPrefix}-custom:latest`);
                          }}
                          className="w-full bg-[#0e111d] border border-card-border rounded-lg px-3 py-2 text-gray-100 font-mono focus:outline-none"
                        >
                          {models?.ollama_models?.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.parameter_size || 'Local'})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Custom Model Name & Domain Specialization */}
                    <div className="space-y-3 p-4 rounded-xl bg-[#141828] border border-card-border">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-300 font-mono">Custom Model Name</label>
                        <input
                          type="text"
                          value={jobName}
                          onChange={(e) => setJobName(e.target.value)}
                          placeholder={`e.g. ${getCleanBaseName(traineeModel)} Cybersecurity Pro`}
                          className="w-full bg-[#101320] border border-card-border rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:border-purple-500/50"
                          required
                        />
                      </div>

                      {/* What Should It Learn? */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-gray-300 font-mono">
                            What Skill / Topic Should It Learn?
                          </label>
                          <span className="text-[10px] text-gray-500 font-mono">Click a preset or type your own</span>
                        </div>

                        {/* Quick Presets with Dynamic Names */}
                        <div className="flex flex-wrap gap-1.5 pb-1">
                          {[
                            { label: '💻 Python & Linux', text: 'Advanced Linux system administration, bash scripting, and high-concurrency Python asyncio development', suffix: 'Python & Linux Pro', tagSuffix: 'linux-coder' },
                            { label: '📊 SQL & Data Analysis', text: 'Complex SQL queries, database indexing, performance optimization, and data modeling', suffix: 'SQL Data Expert', tagSuffix: 'sql-analyst' },
                            { label: '🛡️ Cybersecurity', text: 'Penetration testing, vulnerability scanning, security audits, and red-teaming scripts', suffix: 'Security Master', tagSuffix: 'security' },
                            { label: '📈 Finance & Trading', text: 'Financial modeling, portfolio risk analysis, market forecasting, and quantitative metrics', suffix: 'Finance Analyst', tagSuffix: 'finance' },
                            { label: '🧠 Logic & Reasoning', text: 'Step-by-step mathematical reasoning, algorithmic logic, and rigorous chain-of-thought proofs', suffix: 'Math & Logic Pro', tagSuffix: 'reasoning' }
                          ].map((preset, idx) => {
                            const cleanName = getCleanBaseName(traineeModel);
                            const tagPrefix = getCleanTagPrefix(traineeModel);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setDomainFocus(preset.text);
                                  setJobName(`${cleanName} ${preset.suffix}`);
                                  setTargetIdentifier(`${tagPrefix}-${preset.tagSuffix}:latest`);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#101320] hover:bg-[#1a2034] border border-card-border text-[11px] text-gray-300 font-mono transition-colors"
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>

                        <textarea
                          value={domainFocus}
                          onChange={(e) => setDomainFocus(e.target.value)}
                          rows={2}
                          placeholder="e.g. Help with writing high-performance Python code, debugging server errors, and optimizing databases..."
                          className="w-full bg-[#101320] border border-card-border rounded-lg p-2.5 text-gray-100 focus:outline-none focus:border-purple-500/50 text-xs"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-purple-300 font-mono">Ollama Model Tag / Identifier</label>
                        <input
                          type="text"
                          value={targetIdentifier}
                          onChange={(e) => setTargetIdentifier(e.target.value)}
                          placeholder={`e.g. ${getCleanTagPrefix(traineeModel)}-custom:latest`}
                          className="w-full bg-[#101320] border border-purple-500/40 rounded-lg px-3 py-2 text-purple-300 font-mono font-bold focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold font-mono transition-all shadow-lg shadow-purple-900/40 flex items-center gap-2 cursor-pointer"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                        <span>Start</span>
                      </button>
                    </div>
                  </form>
                </div>
              ) : currentJob ? (
                /* Interactive Step-by-Step Dashboard for Selected Pipeline */
                <div className="space-y-5">
                  
                  {/* Pipeline Header Summary */}
                  <div className="p-5 rounded-2xl bg-[#0f121e] border border-card-border flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-gray-100">{currentJob.name}</h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold">
                          {currentJob.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        Target: <span className="text-purple-300 font-bold">{currentJob.target_identifier}</span> • Focus: {currentJob.domain_focus}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="px-2.5 py-1 rounded-lg bg-[#151928] text-indigo-300 border border-indigo-500/30">
                        Teacher: {currentJob.trainer_model}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#151928] text-emerald-300 border border-emerald-500/30">
                        Base: {currentJob.trainee_model}
                      </span>
                      {(currentJob.status === 'trained' || currentJob.status === 'completed') && (
                        <button
                          type="button"
                          onClick={() => handleIterateOnModel(currentJob)}
                          className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 transition-colors flex items-center gap-1 font-bold"
                          title="Use this model as the base for a new fine-tuning version (v2)"
                        >
                          <RefreshCw className="w-3 h-3 text-purple-300" />
                          <span>Iterate (v2)</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteJob(currentJob.id, currentJob.name)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 transition-colors"
                        title="Delete this custom model / draft"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Live Execution Progress & GPU LoRA Telemetry Console */}
                  {runningAction && (
                    <div className="p-5 rounded-2xl bg-[#0b0e18] border border-purple-500/50 space-y-4 shadow-2xl animate-in slide-in-from-top-2">
                      <div className="flex items-center justify-between border-b border-card-border pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                            <Activity className="w-4 h-4 animate-pulse" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-purple-200 font-mono flex items-center gap-2">
                              <span>{runningAction === 'training_lora' ? '🔥 DEEP LoRA GPU TRAINING ACTIVE' : `PROCESSING ${runningAction.toUpperCase()}`}</span>
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            </span>
                            <div className="text-[11px] text-gray-300 font-mono mt-0.5">
                              {actionStatusText || 'Executing background pipeline tasks...'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {trainingTelemetry && (
                            <span className="px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                              ETA: {trainingTelemetry.eta}
                            </span>
                          )}
                          <div className="px-3 py-1 rounded-lg bg-[#161a2b] border border-card-border font-mono text-xs text-purple-300 font-bold">
                            ⏱️ {elapsedSeconds}s
                          </div>
                        </div>
                      </div>

                      {/* Training Telemetry & Real-Time Loss Chart (When LoRA Training) */}
                      {trainingTelemetry && (
                        <div className="space-y-3">
                          
                          {/* Live Metrics Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="p-3 rounded-xl bg-[#121524] border border-card-border">
                              <span className="text-[10px] uppercase font-mono text-gray-400 font-bold">Current Loss</span>
                              <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5 flex items-center gap-1.5">
                                <span>{trainingTelemetry.loss.toFixed(4)}</span>
                                <span className="text-[10px] text-emerald-500">📉</span>
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[#121524] border border-card-border">
                              <span className="text-[10px] uppercase font-mono text-gray-400 font-bold">Epoch & Step</span>
                              <div className="text-base font-bold text-purple-300 font-mono mt-0.5">
                                Ep {trainingTelemetry.epoch}/{trainingTelemetry.total_epochs} • Step {trainingTelemetry.step}/{trainingTelemetry.total_steps}
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[#121524] border border-card-border">
                              <span className="text-[10px] uppercase font-mono text-gray-400 font-bold">Learning Rate</span>
                              <div className="text-base font-bold text-indigo-300 font-mono mt-0.5">
                                {trainingTelemetry.lr}
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[#121524] border border-card-border">
                              <span className="text-[10px] uppercase font-mono text-gray-400 font-bold">Throughput</span>
                              <div className="text-base font-bold text-pink-300 font-mono mt-0.5">
                                {trainingTelemetry.speed}
                              </div>
                            </div>
                          </div>

                          {/* Dual NVIDIA RTX 5070 GPU VRAM Allocation Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-2.5 rounded-xl bg-[#0d101d] border border-card-border flex items-center justify-between text-xs font-mono">
                              <div className="flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-emerald-400" />
                                <span className="text-gray-300 font-bold">GPU 0 (RTX 5070)</span>
                              </div>
                              <div className="text-emerald-300 text-[11px]">
                                {trainingTelemetry.gpu0_vram} • {trainingTelemetry.gpu_temp}
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl bg-[#0d101d] border border-card-border flex items-center justify-between text-xs font-mono">
                              <div className="flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-purple-400" />
                                <span className="text-gray-300 font-bold">GPU 1 (RTX 5070)</span>
                              </div>
                              <div className="text-purple-300 text-[11px]">
                                {trainingTelemetry.gpu1_vram} • 46°C
                              </div>
                            </div>
                          </div>

                          {/* Live SVG Loss Curve Graph */}
                          {trainingTelemetry.loss_history && trainingTelemetry.loss_history.length > 1 && (
                            <div className="p-3 rounded-xl bg-[#090b13] border border-card-border space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                                <span className="text-purple-300 font-bold">Real-Time Training Loss Curve</span>
                                <span>Initial: {trainingTelemetry.loss_history[0].loss.toFixed(3)} ➔ Current: {trainingTelemetry.loss.toFixed(3)}</span>
                              </div>

                              <div className="h-24 w-full relative flex items-end">
                                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                                  {/* Gradient Definition */}
                                  <defs>
                                    <linearGradient id="lossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                                    </linearGradient>
                                  </defs>
                                  
                                  {/* Grid Lines */}
                                  <line x1="0" y1="20" x2="100" y2="20" stroke="#ffffff10" strokeDasharray="2" />
                                  <line x1="0" y1="50" x2="100" y2="50" stroke="#ffffff10" strokeDasharray="2" />
                                  <line x1="0" y1="80" x2="100" y2="80" stroke="#ffffff10" strokeDasharray="2" />

                                  {/* SVG Polyline and Area */}
                                  {(() => {
                                    const history = trainingTelemetry.loss_history;
                                    const maxL = Math.max(...history.map(h => h.loss), 2.5);
                                    const minL = Math.max(0, Math.min(...history.map(h => h.loss)) * 0.8);
                                    const range = maxL - minL || 1;
                                    const points = history.map((pt, idx) => {
                                      const x = (idx / (history.length - 1 || 1)) * 100;
                                      const y = 90 - ((pt.loss - minL) / range) * 80;
                                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                                    }).join(' ');

                                    const areaPoints = `0,95 ${points} 100,95`;

                                    return (
                                      <>
                                        <polygon points={areaPoints} fill="url(#lossGrad)" />
                                        <polyline
                                          fill="none"
                                          stroke="#a855f7"
                                          strokeWidth="2.5"
                                          points={points}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </>
                                    );
                                  })()}
                                </svg>
                              </div>
                            </div>
                          )}

                        </div>
                      )}

                      {/* Animated Progress Bar */}
                      <div className="w-full bg-[#161a29] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 transition-all duration-300"
                          style={{ width: `${trainingTelemetry?.progress || 100}%` }}
                        />
                      </div>

                      {/* Terminal Logs */}
                      {actionLogs.length > 0 && (
                        <div className="p-3 rounded-xl bg-[#090b12] border border-card-border font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto">
                          {actionLogs.map((log, idx) => (
                            <div key={idx} className="text-gray-300 flex items-start gap-2">
                              <span className="text-purple-400 shrink-0">›</span>
                              <span className="leading-relaxed">{log}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4 Clean Step Cards with Autonomous Auto-Pilot Action Bar */}
                  <div className="space-y-3">
                    
                    {/* Top Auto-Pilot Continuous Execution Banner */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-[#0f121e] border border-purple-500/40 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                          <Wand2 className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-gray-100 flex items-center gap-2 font-mono">
                            <span>Autonomous Wizard Auto-Pilot</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">1-Click Continuous</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Automatically executes Step 1 (Baseline) ➔ Step 2 (Synthesis) ➔ Step 3 (Unsloth QLoRA) ➔ Step 4 (Scorecard) without stopping.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRunFullAutoPipeline(currentJob.id)}
                        disabled={runningAction !== null}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold font-mono text-xs transition-all flex items-center gap-2 shadow-lg shadow-purple-900/40 cursor-pointer"
                      >
                        {runningAction === 'auto_wizard' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Auto Wizard In Progress...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            <span>Run Full 4-Step Auto Pipeline</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* STEP 1: Pre-Eval */}
                    <div className="p-4 rounded-2xl bg-[#0f121e] border border-card-border flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold font-mono text-sm ${
                          hasPreEval ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                        }`}>
                          {hasPreEval ? <Check className="w-5 h-5" /> : '1'}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-gray-100 flex items-center gap-2">
                            <span>Step 1: Baseline Capability Assessment</span>
                            {hasPreEval && (
                              <span className="text-xs text-emerald-400 font-mono">
                                (Baseline Score: {preEval.overall_score}/100)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            Teacher AI tests base model on 3 domain questions to measure baseline skills.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handlePreEval}
                        disabled={runningAction !== null}
                        className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-xs font-bold font-mono transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {runningAction === 'pre_eval' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        <span>{runningAction === 'pre_eval' ? 'Assessing...' : hasPreEval ? 'Re-Run Baseline Eval' : 'Run Baseline Eval'}</span>
                      </button>
                    </div>

                    {/* STEP 2: Synthesize Dataset */}
                    <div className="p-4 rounded-2xl bg-[#0f121e] border border-card-border flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold font-mono text-sm ${
                          currentJob.dataset_id ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        }`}>
                          {currentJob.dataset_id ? <Check className="w-5 h-5" /> : '2'}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-gray-100 flex items-center gap-2">
                            <span>Step 2: Targeted Dataset Synthesis</span>
                            {currentJob.dataset_id && (
                              <span className="text-xs text-purple-300 font-mono">(Dataset Ready)</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            Teacher AI creates tailored instruction-tuning pairs solving baseline weaknesses.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleSynthesizeDataset}
                        disabled={runningAction !== null}
                        className="px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs font-bold font-mono transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {runningAction === 'synthesize' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>{runningAction === 'synthesize' ? 'Synthesizing...' : 'Synthesize Training Pairs'}</span>
                      </button>
                    </div>

                    {/* STEP 3: Unsloth QLoRA GPU Training & Ollama Compilation */}
                    <div className="p-5 rounded-2xl bg-[#0f121e] border border-card-border space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold font-mono text-sm ${
                            currentJob.status === 'trained' || currentJob.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {currentJob.status === 'trained' || currentJob.status === 'completed' ? <Check className="w-5 h-5" /> : '3'}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-gray-100 flex items-center gap-2">
                              <span>Step 3: 🦥 Unsloth Fast QLoRA GPU Training</span>
                              {(currentJob.status === 'trained' || currentJob.status === 'completed') && (
                                <span className="text-xs text-emerald-400 font-mono">
                                  (Registered as {currentJob.target_identifier})
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">
                              Trains real neural network adapter weights across Dual RTX 5070 GPUs using Unsloth OpenAI Triton kernels.
                            </p>
                          </div>
                        </div>

                        {/* Launch Button */}
                        <button
                          onClick={handleRunLoraTraining}
                          disabled={runningAction !== null}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-lg shadow-purple-900/30"
                        >
                          {runningAction === 'training_lora' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          <span>{runningAction === 'training_lora' ? 'Unsloth Training Active...' : 'Start Unsloth QLoRA Training'}</span>
                        </button>
                      </div>

                      {/* LoRA & Unsloth Hardware Parameters Bar */}
                      <div className="pt-3 border-t border-card-border/60 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                        <div className="flex flex-wrap items-center gap-4 text-gray-300 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400">Epochs:</span>
                            <select
                              value={loraEpochs}
                              onChange={(e) => setLoraEpochs(Number(e.target.value))}
                              className="bg-[#151928] border border-card-border rounded px-2 py-0.5 text-gray-200"
                            >
                              <option value={1}>1 Epoch (Ultra-Fast)</option>
                              <option value={3}>3 Epochs (Recommended)</option>
                              <option value={5}>5 Epochs (Deep Fit)</option>
                              <option value={10}>10 Epochs</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400">LoRA Rank (r):</span>
                            <select
                              value={loraRank}
                              onChange={(e) => setLoraRank(Number(e.target.value))}
                              className="bg-[#151928] border border-card-border rounded px-2 py-0.5 text-gray-200"
                            >
                              <option value={8}>r=8 (Fast)</option>
                              <option value={16}>r=16 (Balanced)</option>
                              <option value={32}>r=32 (High Capacity)</option>
                              <option value={64}>r=64 (Max)</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400">Quantization:</span>
                            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                              4-bit QLoRA (NF4)
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400">Engine:</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                              🦥 Unsloth + Triton Kernels
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] text-purple-300 font-mono font-bold">⚡ Dual RTX 5070 GPUs (24GB VRAM)</span>
                      </div>
                    </div>

                    {/* STEP 4: Post-Eval & Comparison */}
                    <div className="p-4 rounded-2xl bg-[#0f121e] border border-card-border flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold font-mono text-sm ${
                          hasPostEval ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40' : 'bg-pink-500/10 text-pink-400 border border-pink-500/30'
                        }`}>
                          {hasPostEval ? <Check className="w-5 h-5" /> : '4'}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-gray-100 flex items-center gap-2">
                            <span>Step 4: Post-Training Capability Assessment</span>
                            {hasPostEval && (
                              <span className="text-xs text-pink-400 font-mono">
                                (Score: {postEval.overall_score}/100 • +{postEval.improvement_percentage}% Delta)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            Teacher AI evaluates the fine-tuned model and produces the Before vs After matrix.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handlePostEval}
                        disabled={runningAction !== null || currentJob.status === 'draft'}
                        className="px-4 py-2 rounded-xl bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/40 text-pink-200 text-xs font-bold font-mono transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {runningAction === 'post_eval' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                        <span>{runningAction === 'post_eval' ? 'Evaluating...' : hasPostEval ? 'Re-Evaluate Delta' : 'Run Post-Eval'}</span>
                      </button>
                    </div>

                  </div>

                  {/* Clean Before vs After Improvement Matrix */}
                  {(hasPreEval || hasPostEval) && (
                    <div className="p-5 rounded-2xl bg-[#0f121e] border border-purple-500/30 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between border-b border-card-border pb-3">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-purple-400" />
                          <h3 className="font-bold text-sm text-gray-100 font-mono uppercase tracking-wider">
                            Before vs After Capability Comparison
                          </h3>
                        </div>
                        {hasPostEval && postEval.improvement_percentage !== undefined && (
                          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold text-xs">
                            +{postEval.improvement_percentage}% Improvement Delta
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                          { key: 'domain_knowledge', label: 'Domain Depth' },
                          { key: 'reasoning_depth', label: 'Reasoning' },
                          { key: 'technical_accuracy', label: 'Tech Accuracy' },
                          { key: 'instruction_adherence', label: 'Adherence' },
                          { key: 'clarity', label: 'Clarity' }
                        ].map(({ key, label }) => {
                          const sPre = preEval.scores?.[key] || 0;
                          const sPost = postEval.scores?.[key] || 0;
                          return (
                            <div key={key} className="p-3 rounded-xl bg-[#141828] border border-card-border space-y-2">
                              <div className="text-[11px] text-gray-300 font-medium">{label}</div>
                              <div className="space-y-1 text-[10px] font-mono">
                                <div className="flex items-center justify-between text-gray-400">
                                  <span>Base:</span>
                                  <span className="font-bold text-gray-200">{sPre}/100</span>
                                </div>
                                {hasPostEval && (
                                  <div className="flex items-center justify-between text-emerald-300 font-bold">
                                    <span>Fine-Tuned:</span>
                                    <span>{sPost}/100</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {postEval.key_improvements && (
                        <div className="p-3 rounded-xl bg-[#121c22] border border-emerald-500/30 text-xs space-y-1">
                          <div className="font-bold text-emerald-300 font-mono">Teacher Judge Feedback:</div>
                          {postEval.executive_summary && (
                            <p className="text-gray-300 text-xs italic mb-1">{postEval.executive_summary}</p>
                          )}
                          <ul className="list-disc list-inside text-emerald-200 text-[11px] space-y-0.5">
                            {postEval.key_improvements.map((imp, idx) => (
                              <li key={idx}>{imp}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Expandable Benchmark Questions & Answers Inspection */}
                      {postEval.benchmark_comparison && postEval.benchmark_comparison.length > 0 && (
                        <div className="pt-2 border-t border-card-border">
                          <button
                            type="button"
                            onClick={() => setShowBenchmarkDetails(!showBenchmarkDetails)}
                            className="w-full py-2 px-3 rounded-xl bg-[#141828] hover:bg-[#1c2238] border border-purple-500/30 text-xs font-mono text-purple-300 font-semibold flex items-center justify-between transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <Search className="w-3.5 h-3.5" />
                              <span>{showBenchmarkDetails ? 'Hide Benchmark Questions & Real Answers' : 'Inspect Actual Benchmark Questions & Real Answers (Before vs After)'}</span>
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${showBenchmarkDetails ? 'rotate-180' : ''}`} />
                          </button>

                          {showBenchmarkDetails && (
                            <div className="mt-3 space-y-3 animate-in fade-in">
                              {postEval.benchmark_comparison.map((sample, idx) => (
                                <div key={idx} className="p-3.5 rounded-xl bg-[#111422] border border-card-border space-y-2.5 text-xs">
                                  <div className="font-bold text-purple-300 font-mono flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 text-[10px]">
                                      Challenge #{idx + 1}
                                    </span>
                                    <span>{sample.question}</span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                    <div className="p-2.5 rounded-lg bg-[#0c0e17] border border-card-border space-y-1">
                                      <span className="text-[10px] uppercase font-mono text-gray-400 font-bold">
                                        Base Model Response (Before)
                                      </span>
                                      <div className="text-gray-300 font-mono text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                                        {sample.base_answer || 'No response captured.'}
                                      </div>
                                    </div>

                                    <div className="p-2.5 rounded-lg bg-[#0e1722] border border-emerald-500/30 space-y-1">
                                      <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold">
                                        Fine-Tuned Model Response (After)
                                      </span>
                                      <div className="text-gray-200 font-mono text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                                        {sample.finetuned_answer || 'No response captured.'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Advanced Training / Follow-up Iteration */}
                      <div className="pt-3 border-t border-card-border flex items-center justify-between">
                        <div className="text-xs text-gray-400">
                          Want to train further on top of this model? Launch advanced iterations.
                        </div>
                        <button
                          type="button"
                          onClick={() => handleIterateOnModel(currentJob)}
                          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Advanced training ({currentJob.name} v2)</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              ) : null}

            </div>
          )}

          {/* TAB 2: MANUAL FINE-TUNING */}
          {activeTab === 'manual' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="p-6 rounded-2xl bg-[#0f121e] border border-indigo-500/40 space-y-5 shadow-2xl">
                <div className="border-b border-card-border pb-3">
                  <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-indigo-400" />
                    <span>Manual Training</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Select your local base model, attach a dataset from your Dataset Hub, and launch QLoRA fine-tuning.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Base Model Selection */}
                  <div className="p-4 rounded-xl bg-[#141828] border border-card-border space-y-2">
                    <label className="text-[11px] font-bold text-emerald-300 font-mono">Base Model to Fine-Tune (Local GPU)</label>
                    <select
                      value={traineeModel}
                      onChange={(e) => {
                        const newModel = e.target.value;
                        setTraineeModel(newModel);
                        const cleanName = getCleanBaseName(newModel);
                        const tagPrefix = getCleanTagPrefix(newModel);
                        setJobName(`${cleanName} Custom Expert`);
                        setTargetIdentifier(`${tagPrefix}-custom:latest`);
                      }}
                      className="w-full bg-[#0e111d] border border-card-border rounded-lg px-3 py-2 text-gray-100 font-mono focus:outline-none focus:border-emerald-500/50"
                    >
                      {models?.ollama_models?.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.parameter_size || 'Local'})</option>
                      ))}
                    </select>
                  </div>

                  {/* Model Name & Tag */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-300 font-mono">Custom Model Name</label>
                      <input
                        type="text"
                        value={jobName}
                        onChange={(e) => setJobName(e.target.value)}
                        placeholder={`e.g. ${getCleanBaseName(traineeModel)} Custom Expert`}
                        className="w-full bg-[#141828] border border-card-border rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-purple-300 font-mono">Ollama Tag / Identifier</label>
                      <input
                        type="text"
                        value={targetIdentifier}
                        onChange={(e) => setTargetIdentifier(e.target.value)}
                        placeholder={`e.g. ${getCleanTagPrefix(traineeModel)}-custom:latest`}
                        className="w-full bg-[#141828] border border-purple-500/40 rounded-xl px-3 py-2 text-purple-300 font-bold font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Dataset Attachment Section (Hub Selection Only) */}
                  <div className="p-4 rounded-xl bg-[#141828] border border-card-border space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-gray-200 font-mono flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Select Available Dataset from Hub</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveTab('datasets')}
                        className="text-[11px] font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Open Dataset Hub →</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {datasets.length === 0 ? (
                        <div className="p-4 text-center rounded-xl bg-[#0e111d] border border-dashed border-card-border space-y-2">
                          <p className="text-gray-400 font-mono text-xs">
                            No datasets available in your Dataset Hub.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab('datasets')}
                            className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition-all inline-flex items-center gap-1.5"
                          >
                            <Database className="w-3.5 h-3.5" />
                            <span>Manage Datasets in Hub</span>
                          </button>
                        </div>
                      ) : (
                        <select
                          value={selectedDatasetId}
                          onChange={(e) => setSelectedDatasetId(e.target.value)}
                          className="w-full bg-[#0e111d] border border-card-border rounded-lg px-3 py-2 text-gray-100 font-mono focus:outline-none focus:border-purple-500/50"
                        >
                          <option value="">-- Choose a Dataset from Hub --</option>
                          {datasets.map(d => (
                            <option key={d.id} value={d.id}>{d.name} ({d.sample_count} training samples)</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Manual Training & Post-Evaluation Controls */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-card-border">
                    <button
                      onClick={handleSavePipeline}
                      className="px-4 py-2 rounded-xl bg-[#161a28] hover:bg-[#1e2338] text-gray-300 font-bold font-mono transition-all"
                    >
                      Save Configuration
                    </button>
                    <button
                      onClick={handleCompileAndRegister}
                      disabled={runningAction !== null || !selectedDatasetId}
                      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold font-mono transition-all flex items-center gap-2 shadow-md cursor-pointer"
                    >
                      {runningAction === 'training_lora' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      <span>Launch Unsloth QLoRA Training</span>
                    </button>
                    <button
                      onClick={handlePostEval}
                      disabled={runningAction !== null}
                      className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold font-mono transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                    >
                      {runningAction === 'post_eval' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                      <span>Run Post-Eval Scorecard</span>
                    </button>
                  </div>

                  {/* Live Execution Progress & GPU LoRA Telemetry Console for Manual Training */}
                  {runningAction && (
                    <div className="mt-5 p-5 rounded-2xl bg-[#0b0e18] border border-purple-500/50 space-y-4 shadow-2xl animate-in slide-in-from-top-2">
                      <div className="flex items-center justify-between border-b border-card-border pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                            <Activity className="w-4 h-4 animate-pulse" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-purple-200 font-mono flex items-center gap-2">
                              <span>{runningAction === 'training_lora' ? '🔥 UNSLOTH QLORA TRAINING ACTIVE' : `PROCESSING ${runningAction.toUpperCase()}`}</span>
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            </span>
                            <div className="text-[11px] text-gray-300 font-mono mt-0.5">
                              {actionStatusText || 'Executing background pipeline tasks...'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {trainingTelemetry && (
                            <span className="px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                              ETA: {trainingTelemetry.eta}
                            </span>
                          )}
                          <div className="px-3 py-1 rounded-lg bg-[#161a2b] border border-card-border font-mono text-xs text-purple-300 font-bold">
                            ⏱️ {elapsedSeconds}s
                          </div>
                        </div>
                      </div>

                      {/* Training Telemetry & Real-Time Loss Metrics */}
                      {trainingTelemetry && (
                        <div className="space-y-3">
                          {/* Live Metrics Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="p-3 rounded-xl bg-[#121524] border border-card-border">
                              <span className="text-[10px] uppercase font-mono text-gray-400 font-bold">Current Loss</span>
                              <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5 flex items-center gap-1.5">
                                <span>{trainingTelemetry.loss.toFixed(4)}</span>
                                <span className="text-[10px] text-emerald-500">📉</span>
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[#121524] border border-card-border">
                              <span className="text-[10px] uppercase font-mono text-gray-400 font-bold">Epoch & Step</span>
                              <div className="text-base font-bold text-purple-300 font-mono mt-0.5">
                                Ep {trainingTelemetry.epoch}/{trainingTelemetry.total_epochs} • Step {trainingTelemetry.step}/{trainingTelemetry.total_steps}
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[#121524] border border-card-border">
                              <span className="text-[10px] uppercase font-mono text-gray-400 font-bold">Learning Rate</span>
                              <div className="text-base font-bold text-indigo-300 font-mono mt-0.5">
                                {trainingTelemetry.lr}
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[#121524] border border-card-border">
                              <span className="text-[10px] uppercase font-mono text-gray-400 font-bold">Throughput</span>
                              <div className="text-base font-bold text-pink-300 font-mono mt-0.5">
                                {trainingTelemetry.speed}
                              </div>
                            </div>
                          </div>

                          {/* Dual NVIDIA RTX 5070 GPU VRAM Allocation Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-2.5 rounded-xl bg-[#0d101d] border border-card-border flex items-center justify-between text-xs font-mono">
                              <div className="flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-emerald-400" />
                                <span className="text-gray-300 font-bold">GPU 0 (RTX 5070)</span>
                              </div>
                              <div className="text-emerald-300 text-[11px]">
                                {trainingTelemetry.gpu0_vram} • {trainingTelemetry.gpu_temp}
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl bg-[#0d101d] border border-card-border flex items-center justify-between text-xs font-mono">
                              <div className="flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-purple-400" />
                                <span className="text-gray-300 font-bold">GPU 1 (RTX 5070)</span>
                              </div>
                              <div className="text-purple-300 text-[11px]">
                                {trainingTelemetry.gpu1_vram} • 46°C
                              </div>
                            </div>
                          </div>

                          {/* Real-Time SVG Loss Curve Graph */}
                          {trainingTelemetry.loss_history && trainingTelemetry.loss_history.length > 1 && (
                            <div className="p-3 rounded-xl bg-[#090b13] border border-card-border space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                                <span className="text-purple-300 font-bold">Real-Time Training Loss Curve</span>
                                <span>Initial: {trainingTelemetry.loss_history[0].loss.toFixed(3)} ➔ Current: {trainingTelemetry.loss.toFixed(3)}</span>
                              </div>

                              <div className="h-24 w-full relative flex items-end">
                                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                                  <defs>
                                    <linearGradient id="lossGradManual" x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                                    </linearGradient>
                                  </defs>
                                  
                                  <line x1="0" y1="20" x2="100" y2="20" stroke="#ffffff10" strokeDasharray="2" />
                                  <line x1="0" y1="50" x2="100" y2="50" stroke="#ffffff10" strokeDasharray="2" />
                                  <line x1="0" y1="80" x2="100" y2="80" stroke="#ffffff10" strokeDasharray="2" />

                                  {(() => {
                                    const history = trainingTelemetry.loss_history;
                                    const maxL = Math.max(...history.map(h => h.loss), 2.5);
                                    const minL = Math.max(0, Math.min(...history.map(h => h.loss)) * 0.8);
                                    const range = maxL - minL || 1;
                                    const points = history.map((pt, idx) => {
                                      const x = (idx / (history.length - 1 || 1)) * 100;
                                      const y = 90 - ((pt.loss - minL) / range) * 80;
                                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                                    }).join(' ');

                                    const areaPoints = `0,95 ${points} 100,95`;

                                    return (
                                      <>
                                        <polygon points={areaPoints} fill="url(#lossGradManual)" />
                                        <polyline
                                          fill="none"
                                          stroke="#a855f7"
                                          strokeWidth="2.5"
                                          points={points}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </>
                                    );
                                  })()}
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Animated Progress Bar */}
                      <div className="w-full bg-[#161a29] h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 transition-all duration-300"
                          style={{ width: `${trainingTelemetry?.progress || 100}%` }}
                        />
                      </div>

                      {/* Terminal Logs */}
                      {actionLogs.length > 0 && (
                        <div className="p-3 rounded-xl bg-[#090b12] border border-card-border font-mono text-[11px] space-y-1 max-h-40 overflow-y-auto">
                          {actionLogs.map((log, idx) => (
                            <div key={idx} className="text-gray-300 flex items-start gap-2">
                              <span className="text-purple-400 shrink-0">›</span>
                              <span className="leading-relaxed">{log}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM DATASET HUB (View, Edit, Remove, AI Generate, Upload) */}
          {activeTab === 'datasets' && (
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Top Action Card: Ask AI to Generate or Upload Dataset */}
              <div className="p-5 rounded-2xl bg-[#0f121e] border border-purple-500/40 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-card-border pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h3 className="font-bold text-sm text-gray-100 font-mono uppercase tracking-wider">
                      Ask AI to Generate Custom Dataset
                    </h3>
                  </div>
                  
                  {/* Upload Button */}
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleUploadFile}
                      accept=".jsonl,.json,.csv"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-1.5 rounded-xl bg-[#151928] hover:bg-[#1f243a] border border-card-border text-gray-300 text-xs font-mono font-semibold transition-all flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Upload JSONL / JSON</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] uppercase font-mono text-gray-400">Dataset Topic & Focus</label>
                    <input
                      type="text"
                      value={hubSynthTopic}
                      onChange={(e) => setHubSynthTopic(e.target.value)}
                      placeholder="e.g. Kubernetes RBAC security policies and misconfiguration edge cases"
                      className="w-full bg-[#141828] border border-card-border rounded-xl px-3 py-2 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono text-gray-400">Dataset Name (Optional)</label>
                    <input
                      type="text"
                      value={hubSynthName}
                      onChange={(e) => setHubSynthName(e.target.value)}
                      placeholder="e.g. K8s Security Dataset"
                      className="w-full bg-[#141828] border border-card-border rounded-xl px-3 py-2 text-gray-100 font-mono focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono text-gray-400">Sample Count</label>
                    <select
                      value={hubSynthCount}
                      onChange={(e) => setHubSynthCount(Number(e.target.value))}
                      className="w-full bg-[#141828] border border-card-border rounded-xl px-3 py-2 text-gray-100 font-mono focus:outline-none"
                    >
                      <option value={5}>5 Pairs</option>
                      <option value={8}>8 Pairs</option>
                      <option value={15}>15 Pairs</option>
                      <option value={25}>25 Pairs</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={handleHubGenerateDataset}
                    disabled={isSynthesizingInHub || !hubSynthTopic.trim()}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono text-xs transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                  >
                    {isSynthesizingInHub ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{isSynthesizingInHub ? 'Synthesizing Pairs...' : 'Generate & Add to Hub'}</span>
                  </button>
                </div>
              </div>

              {/* Datasets Hub Split View: List on Left, Inspector & Editor on Right */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Left: Datasets List */}
                <div className="p-4 rounded-2xl bg-[#0f121e] border border-card-border space-y-3 flex flex-col h-[520px]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono flex items-center justify-between pb-2 border-b border-card-border">
                    <span>Saved Datasets</span>
                    <span className="text-purple-400 font-bold">({datasets.length})</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {datasets.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 font-mono text-xs">
                        No datasets saved in Hub yet. Generate one above!
                      </div>
                    ) : (
                      datasets.map(d => {
                        const isSelected = activeHubDataset?.id === d.id;
                        return (
                          <div
                            key={d.id}
                            onClick={() => fetchDatasetDetails(d.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-purple-600/20 border-purple-500/50 shadow-sm'
                                : 'bg-[#131622] hover:bg-[#181c2c] border-card-border'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-gray-100 truncate mr-2">{d.name}</span>
                              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono shrink-0">
                                {d.sample_count} pairs
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 truncate mt-1">{d.description || 'Custom dataset'}</p>
                            <div className="flex items-center justify-between text-[9px] text-gray-500 font-mono mt-2 pt-1 border-t border-white/5">
                              <span>{new Date(d.created_at).toLocaleDateString()}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDataset(d.id);
                                }}
                                className="text-red-400 hover:text-red-300 transition-colors"
                                title="Delete dataset"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right: Dataset Inspector & Sample Editor */}
                <div className="md:col-span-2 p-5 rounded-2xl bg-[#0f121e] border border-card-border flex flex-col h-[520px] shadow-xl">
                  {activeHubDataset ? (
                    <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
                      <div className="flex items-center justify-between pb-3 border-b border-card-border shrink-0">
                        <div>
                          {isEditingDataset ? (
                            <input
                              type="text"
                              value={editingDatasetName}
                              onChange={(e) => setEditingDatasetName(e.target.value)}
                              className="bg-[#141828] border border-purple-500/40 rounded-lg px-2 py-1 text-xs font-bold text-gray-100 font-mono"
                            />
                          ) : (
                            <h3 className="font-bold text-sm text-gray-100">{activeHubDataset.name}</h3>
                          )}
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                            {editingDatasetData.length} training pairs • ID: {activeHubDataset.id}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isEditingDataset ? (
                            <>
                              <button
                                onClick={() => setIsEditingDataset(false)}
                                className="px-3 py-1 rounded-lg bg-[#161a28] text-gray-300 text-xs font-mono"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveDatasetEdits}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center gap-1"
                              >
                                <Save className="w-3 h-3" />
                                <span>Save Changes</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setIsEditingDataset(true)}
                              className="px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-mono font-semibold flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit Samples</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Samples Viewer / Editor List */}
                      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {editingDatasetData.map((item, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-[#131622] border border-card-border space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-indigo-300 font-mono">Sample #{idx + 1}</span>
                              {isEditingDataset && (
                                <button
                                  onClick={() => setEditingDatasetData(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-red-400 hover:text-red-300 text-[10px] font-mono flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Remove Pair</span>
                                </button>
                              )}
                            </div>

                            {isEditingDataset ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={item.instruction || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditingDatasetData(prev => prev.map((p, i) => i === idx ? { ...p, instruction: val } : p));
                                  }}
                                  placeholder="Instruction / Prompt..."
                                  className="w-full bg-[#0d0f17] border border-card-border rounded-lg px-2.5 py-1 text-xs text-gray-100 font-mono"
                                />
                                <textarea
                                  value={item.output || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditingDatasetData(prev => prev.map((p, i) => i === idx ? { ...p, output: val } : p));
                                  }}
                                  rows={3}
                                  placeholder="Response / Solution..."
                                  className="w-full bg-[#0d0f17] border border-card-border rounded-lg p-2 text-xs text-gray-200 font-mono"
                                />
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="text-gray-200 font-semibold font-mono">{item.instruction}</div>
                                {item.input && <div className="text-[11px] text-gray-400 font-mono">Context: {item.input}</div>}
                                <div className="p-2 rounded-lg bg-[#0a0c13] text-gray-300 font-mono text-[11px] whitespace-pre-wrap">
                                  {item.output}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-gray-500 font-mono text-xs">
                      Select a dataset on the left to inspect or edit samples.
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: ARENA SIDE-BY-SIDE */}
          {activeTab === 'arena' && (
            <div className="max-w-5xl mx-auto space-y-5">
              <div className="p-5 rounded-2xl bg-[#0f121e] border border-card-border space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-purple-400" />
                    <h3 className="font-bold text-sm text-gray-100 font-mono uppercase tracking-wider">
                      Side-by-Side Benchmark Arena
                    </h3>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">Compare Base vs Fine-Tuned outputs live</span>
                </div>

                <div className="space-y-2">
                  <textarea
                    value={arenaPrompt}
                    onChange={(e) => setArenaPrompt(e.target.value)}
                    rows={3}
                    placeholder="Enter a challenging domain benchmark question to test both models..."
                    className="w-full bg-[#151928] border border-card-border rounded-xl p-3 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 font-sans"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-gray-500 mr-1.5">Base:</span>
                        <select
                          value={arenaBaseModel}
                          onChange={(e) => setArenaBaseModel(e.target.value)}
                          className="bg-[#151928] border border-card-border rounded-lg px-2 py-1 text-xs text-gray-200 font-mono"
                        >
                          {models?.ollama_models?.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="text-[10px] text-gray-500 mr-1.5">Fine-Tuned:</span>
                        <select
                          value={arenaFinetunedModel || currentJob?.target_identifier}
                          onChange={(e) => setArenaFinetunedModel(e.target.value)}
                          className="bg-[#151928] border border-purple-500/40 rounded-lg px-2 py-1 text-xs text-purple-300 font-bold font-mono"
                        >
                          {jobs.map(j => (
                            <option key={j.id} value={j.target_identifier}>{j.target_identifier}</option>
                          ))}
                          {models?.ollama_models?.map(m => (
                            <option key={`m-${m.id}`} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={handleRunArena}
                      disabled={isArenaStreaming || !arenaPrompt.trim()}
                      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-md"
                    >
                      {isArenaStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>{isArenaStreaming ? 'Benchmarking Both...' : 'Run Dual Benchmark'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Side by side response cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#0f121e] border border-card-border space-y-2 flex flex-col h-[400px]">
                  <div className="flex items-center justify-between pb-2 border-b border-card-border">
                    <span className="font-bold text-xs text-gray-300 font-mono">Base: {arenaBaseModel}</span>
                    <span className="text-[10px] text-gray-500 font-mono">Baseline</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {arenaBaseOutput || <span className="text-gray-600 italic">Awaiting response...</span>}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#0f121e] border border-purple-500/40 space-y-2 flex flex-col h-[400px] shadow-lg">
                  <div className="flex items-center justify-between pb-2 border-b border-purple-500/30">
                    <span className="font-bold text-xs text-purple-300 font-mono">
                      Fine-Tuned: {arenaFinetunedModel || currentJob?.target_identifier}
                    </span>
                    <span className="text-[10px] text-purple-400 font-mono font-bold">Specialized</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 font-mono text-xs text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {arenaFinetunedOutput || <span className="text-gray-600 italic">Awaiting response...</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* TEACHER MODEL FULL SEARCH & PASTE MODAL */}
      {isTeacherModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0f121e] border border-indigo-500/40 rounded-2xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-card-border shrink-0">
              <div>
                <h3 className="font-bold text-sm text-gray-100 flex items-center gap-2 font-mono">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  <span>Select Teacher Model</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Search across OpenRouter models or paste any custom model identifier.
                </p>
              </div>
              <button onClick={() => setIsTeacherModalOpen(false)} className="text-gray-400 hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Paste Custom Model ID Section */}
            <div className="p-3.5 rounded-xl bg-[#141828] border border-indigo-500/30 space-y-2 shrink-0">
              <div className="flex items-center justify-between text-xs font-mono text-indigo-300 font-bold">
                <span>Paste Model Identifier</span>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-indigo-300 transition-colors"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Paste from Clipboard</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={pastedModelInput}
                  onChange={(e) => setPastedModelInput(e.target.value)}
                  placeholder="e.g. anthropic/claude-3.5-sonnet, deepseek/deepseek-r1, meta-llama/llama-3.1-405b"
                  className="flex-1 bg-[#0e111d] border border-card-border rounded-lg px-3 py-1.5 text-xs text-gray-100 font-mono focus:outline-none focus:border-indigo-500/50"
                />
                <button
                  type="button"
                  onClick={handleApplyPastedModel}
                  disabled={!pastedModelInput.trim()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold font-mono transition-all"
                >
                  Use Model
                </button>
              </div>
            </div>

            {/* Live Search Bar */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={modelSearchQuery}
                onChange={(e) => setModelSearchQuery(e.target.value)}
                placeholder="Search models (e.g. deepseek, claude, llama, gpt, qwen)..."
                className="w-full bg-[#141828] border border-card-border rounded-xl pl-9 pr-3 py-2 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50 font-mono"
              />
            </div>

            {/* Models List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {catalogLoading ? (
                <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2 font-mono">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Loading OpenRouter Catalog...</span>
                </div>
              ) : filteredTeacherModels.length === 0 ? (
                <div className="p-8 text-center text-gray-500 font-mono">
                  No models matched "{modelSearchQuery}". You can paste the custom ID above.
                </div>
              ) : (
                filteredTeacherModels.map((m) => {
                  const isCurrent = trainerModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setTrainerModel(m.id);
                        setIsTeacherModalOpen(false);
                        setNotice({ type: 'success', text: `Selected Teacher: ${m.name || m.id}` });
                        setTimeout(() => setNotice(null), 3000);
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between group ${
                        isCurrent
                          ? 'bg-indigo-600/25 border-indigo-500 text-indigo-100 shadow-sm'
                          : 'bg-[#121524] hover:bg-[#181c30] border-card-border text-gray-300'
                      }`}
                    >
                      <div className="truncate mr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-100">{m.name || m.id}</span>
                          {m.badge && (
                            <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-bold font-mono">
                              {m.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-gray-400 truncate mt-0.5">
                          {m.id} {m.context_length ? `• ${Math.round(m.context_length / 1000)}k ctx` : ''}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isCurrent ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                            Selected
                          </span>
                        ) : (
                          <span className="text-[10px] text-indigo-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                            Select ➔
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
