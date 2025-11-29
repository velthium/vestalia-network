"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { showErrorAlert } from "@/utils/alerts/error";
import { loadDirectoryContents, createNewFolder, downloadFile, uploadFile, deleteItem, renameItem, safeUpgradeSigner, getStorageStatus, shareFile, unshareFile, getFileViewers } from "@/lib/jackalActions";

const JACKAL_ROOT = ["s", "Home"];
const REDUNDANCY_FACTOR = 3; // Jackal protocol uses 3x redundancy

// Simple queue to limit concurrent downloads
const thumbnailQueue = {
  queue: [],
  pending: 0,
  max: 3, // Limit to 3 concurrent downloads
  add: function(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  },
  process: async function() {
    if (this.pending >= this.max || this.queue.length === 0) return;
    this.pending++;
    const { fn, resolve, reject } = this.queue.shift();
    try {
      const res = await fn();
      resolve(res);
    } catch (e) {
      reject(e);
    } finally {
      this.pending--;
      this.process();
    }
  }
};

const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1000; // Use 1000 instead of 1024 to match commercial storage units (1GB = 10^9 bytes)
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const StorageWidget = ({ used, total }) => {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const available = Math.max(0, total - used);
  
  const radius = 60;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="card border-0 shadow-sm w-100" style={{ 
      background: 'linear-gradient(to right, #667eea 0%, #8b5cf6 50%, #a855f7 100%)', 
      borderRadius: '24px',
      overflow: 'hidden'
    }}>
      <div className="card-body px-5 py-4">
        <div className="d-flex align-items-center">
          <div className="position-relative d-flex align-items-center justify-content-center me-4">
            <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
              <circle stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} fill="transparent" r={normalizedRadius} cx={radius} cy={radius} />
              <circle stroke="white" strokeWidth={stroke} strokeDasharray={circumference + ' ' + circumference} style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }} strokeLinecap="round" fill="transparent" r={normalizedRadius} cx={radius} cy={radius} />
            </svg>
            <div className="position-absolute text-center">
              <div className="text-white fw-bold" style={{ fontSize: '1.3rem' }}>{percentage.toFixed(0)}%</div>
            </div>
          </div>
          <div className="text-white flex-grow-1">
            <div className="mb-3">
              <div className="text-white opacity-75 mb-1" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Used Storage</div>
              <div className="fw-bold" style={{ fontSize: '1.75rem', letterSpacing: '-0.02em' }}>{formatBytes(used)}</div>
            </div>
            <div>
              <div className="text-white opacity-75 mb-1" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Available</div>
              <div className="fw-semibold" style={{ fontSize: '1.25rem' }}>{formatBytes(available)}</div>
            </div>
          </div>
          <div className="text-white text-end" style={{ fontSize: '1rem', fontWeight: '500' }}>
            Total: {formatBytes(total)}
          </div>
        </div>
      </div>
    </div>
  );
};

const FileThumbnail = ({ item, storageHandler, fullPath }) => {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = async () => {
    if (!storageHandler || !item || !fullPath) return;
    if (!item.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return;
    
    setLoading(true);
    setError(false);
    try {
      const tracker = { progress: 0, chunks: [] };
      // Use queue to prevent network congestion
      const blob = await thumbnailQueue.add(() => downloadFile(storageHandler, fullPath, tracker, item.raw));
      const u = URL.createObjectURL(blob);
      setUrl(u);
    } catch (e) {
      console.error("Thumbnail load error:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => { if(url) URL.revokeObjectURL(url); };
  }, [item, storageHandler, fullPath]);

  if (loading) return <span className="spinner-border spinner-border-sm text-secondary" role="status" style={{width: '22px', height: '22px'}}></span>;
  if (error) {
    return <span title="Error loading thumbnail. The file might be unavailable." onClick={(e) => { e.stopPropagation(); load(); }} style={{cursor: 'pointer', fontSize: '1.2rem'}}>⚠️</span>;
  }
  if (url) return <img src={url} alt="thumbnail" style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px'}} />;
  return <i className="bi bi-file-earmark-fill" style={{ fontSize: '2rem', color: '#6b7280' }}></i>;
};

export default function Vault() {
  const [storageHandler, setStorageHandler] = useState(null);
  const [items, setItems] = useState([]);
  const [pathStack, setPathStack] = useState(JACKAL_ROOT);
  const [pathStackIds, setPathStackIds] = useState(JACKAL_ROOT);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [dragOverId, setDragOverId] = useState(null);
  const dropTargetRef = useRef(null);
  const { connected, loading: walletLoading, storage } = useWallet();
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);
  const [selectedItemInfo, setSelectedItemInfo] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [starredItems, setStarredItems] = useState([]);
  const [activeView, setActiveView] = useState('all'); // 'all', 'starred', 'recent', 'deleted'
  const [shareModalItem, setShareModalItem] = useState(null);
  const [shareAddress, setShareAddress] = useState('');
  const [fileViewers, setFileViewers] = useState([]);
  const [sharingLoading, setSharingLoading] = useState(false);

  const logIfNotUserRejected = (err, prefix = '') => { const msg = err?.message || String(err || ''); if (/request rejected|user rejected/i.test(msg)) console.debug(prefix, 'user rejected signer request:', msg); else console.error(prefix, err); };

  // Load starred items from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('jackal-starred-items');
    if (saved) {
      try {
        setStarredItems(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load starred items:', e);
      }
    }
  }, []);

  // Toggle star status
  const toggleStar = (item) => {
    const itemKey = `${pathStackIds.join('/')}/${item.raw?.fileMeta?.name || item.name}`;
    const newStarred = starredItems.includes(itemKey)
      ? starredItems.filter(key => key !== itemKey)
      : [...starredItems, itemKey];
    setStarredItems(newStarred);
    localStorage.setItem('jackal-starred-items', JSON.stringify(newStarred));
  };

  const isStarred = (item) => {
    const itemKey = `${pathStackIds.join('/')}/${item.raw?.fileMeta?.name || item.name}`;
    return starredItems.includes(itemKey);
  };

  const handleAccountMissing = async (err) => {
    const msg = err?.message || String(err || "");
    if (msg.includes("does not exist on chain") || msg.includes("Send some tokens")) {
      setBlocked(true);
      try { await showErrorAlert("Account empty", "This wallet has no JACKAL (JKL). Please send some JKL tokens to your address before using the Vault. You will be redirected to Pricing."); } catch (e) { console.warn("showErrorAlert failed:", e); }
      try { router.push("/pricing"); } catch (e) { window.location.href = "/pricing"; }
      return true;
    }
    return false;
  };

  useEffect(() => {
    const init = async () => {
      if (!connected || !storage) return;
      try {
        setStatusMessage("Initializing Jackal storage...");
        setLoading(true);
        try { await safeUpgradeSigner(storage); } catch (e) { console.debug('vault:init safeUpgradeSigner unexpected error:', e?.message || e); }
        await storage.initStorage();
        
        // Load provider pool once at initialization
        try {
          const availableProviders = await storage.getAvailableProviders();
          const providerIps = await storage.findProviderIps(availableProviders);
          await storage.loadProviderPool(providerIps);
        } catch (e) {
          console.debug('vault:init loadProviderPool error:', e?.message || e);
        }
        
        setStorageHandler(storage);
        
        // Fetch storage status
        try {
          const status = await getStorageStatus(storage);
          if (status) {
            console.debug('Storage status:', status);
            setStorageInfo(status);
          }
        } catch (e) {
          console.warn('Failed to get storage status:', e);
        }

        await refreshDirectory(pathStackIds.join('/'), storage);
        setStatusMessage("");
      } catch (err) {
        logIfNotUserRejected(err, 'vault:init');
        if (await handleAccountMissing(err)) return;
        setStatusMessage("Error initializing storage: " + (err?.message || String(err)));
      } finally { setLoading(false); }
    };
    init();
  }, [connected, storage]);

  const refreshDirectory = async (path, handler = storageHandler) => {
    if (!handler) return;
    try {
      setLoading(true);
      let displayPath = String(path || '').replace(/^\/?s\/?/, '');
      if (!displayPath) displayPath = 'Home';
      setStatusMessage(`Loading ${displayPath}...`);
      const normalized = await loadDirectoryContents(handler, path);
      setItems(normalized);
      setStatusMessage("");
    } catch (err) {
      logIfNotUserRejected(err, 'refreshDirectory');
      if (await handleAccountMissing(err)) return;
      setStatusMessage("Error loading directory: " + (err?.message || String(err)));
      setItems([]);
    } finally { setLoading(false); }
  };

  const deriveId = (it) => { const r = it?.raw || it; if (!r) return it?.name || ''; return r.ulid?.toString?.() || r.ulid || r.ulidString?.toString?.() || r.ref || (r.folder && (r.folder.ulid || r.folder.ref)) || r.name || r.whoAmI || it?.name || ''; };

  const handleOpenFolder = async (item) => {
    const id = deriveId(item);
    const label = item?.raw?.whoAmI || item.name;
    const newIds = [...pathStackIds, id];
    const newLabels = [...pathStack, label];
    setPathStackIds(newIds);
    setPathStack(newLabels);
    await refreshDirectory(newIds.join("/"));
  };

  const handleGoBack = async () => {
    if (pathStackIds.length <= JACKAL_ROOT.length) return;
    const newIds = [...pathStackIds]; const newLabels = [...pathStack];
    newIds.pop(); newLabels.pop();
    setPathStackIds(newIds); setPathStack(newLabels);
    await refreshDirectory(newIds.join("/"));
  };

  const handleCreateFolder = async () => {
    const folderName = prompt("Folder name:");
    if (!folderName || !storageHandler) return;
    try {
      const parentPath = pathStackIds.join("/");
      setStatusMessage(`Creating folder ${folderName}...`);
      await createNewFolder(storageHandler, parentPath, folderName);
      await refreshDirectory(parentPath);
      setStatusMessage("Folder created!");
    } catch (err) {
      logIfNotUserRejected(err, 'handleCreateFolder');
      if (await handleAccountMissing(err)) return;
      setStatusMessage("Error creating folder: " + (err?.message || String(err)));
    }
  };

  const handleDragOver = (e) => e.preventDefault();
  const handleDragEnterFolder = (item) => setDragOverId(item?.raw?.name || item.name);
  const handleDragLeaveFolder = (item) => setDragOverId(null);

  const handleDropOnFolder = async (item, e) => {
    e.preventDefault();
    e.stopPropagation();
    dropTargetRef.current = 'folder';
    setDragOverId(null);
    if (!storageHandler) return;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const targetPath = (pathStack.join('/') + '/' + item.name).replace(/(^\/|\/\/$)/g, '');
    try {
      setUploading(true);
      setUploadProgress(0);
      setStatusMessage(`Uploading ${files.length} file(s) to ${item.name}...`);
      for (let i = 0; i < files.length; i++) {
        await uploadFile(storageHandler, files[i], targetPath);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      await refreshDirectory(pathStackIds.join('/'));
      setStatusMessage('Upload complete!');
      setTimeout(() => setUploadProgress(0), 2000);
    } catch (err) {
      logIfNotUserRejected(err, 'handleDropOnFolder');
      if (await handleAccountMissing(err)) return;
      setStatusMessage('Upload failed: ' + (err?.message || String(err)));
    } finally { 
      setUploading(false); 
      dropTargetRef.current = null;
    }
  };

  const handleDropOnRoot = async (e) => {
    // Vérifier si on a droppé sur un folder item (pas sur le conteneur général)
    const target = e.target;
    const folderItem = target.closest('.list-group-item[data-is-folder="true"]');
    if (folderItem) {
      return; // Laisser handleDropOnFolder gérer ça
    }
    
    e.preventDefault();
    if (!storageHandler) return;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const parentPath = pathStack.join('/');
    try {
      setUploading(true);
      setUploadProgress(0);
      setStatusMessage(`Uploading ${files.length} file(s)...`);
      for (let i = 0; i < files.length; i++) {
        await uploadFile(storageHandler, files[i], parentPath);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      await refreshDirectory(parentPath);
      setStatusMessage('Upload complete!');
      setTimeout(() => setUploadProgress(0), 2000);
    } catch (err) {
      logIfNotUserRejected(err, 'handleDropOnRoot');
      if (await handleAccountMissing(err)) return;
      setStatusMessage('Upload failed: ' + (err?.message || String(err)));
    } finally { setUploading(false); }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !storageHandler) return;
    try {
      setUploading(true);
      setUploadProgress(0);
      setStatusMessage(`Uploading ${file.name}...`);
      const parentPath = pathStack.join("/");
      await uploadFile(storageHandler, file, parentPath);
      setUploadProgress(100);
      await refreshDirectory(pathStackIds.join("/"));
      setStatusMessage("Upload complete!");
      setTimeout(() => setUploadProgress(0), 2000);
    } catch (err) {
      logIfNotUserRejected(err, 'handleFileUpload');
      if (await handleAccountMissing(err)) return;
      setStatusMessage("Upload failed: " + (err?.message || String(err)));
    } finally {
      setUploading(false);
      event.target.value = null;
    }
  };



  const handleDeleteItem = async (item) => {
    if (!storageHandler || !item) return;
    const parentPath = pathStackIds.join('/');
    const namePart = item.isDir ? deriveId(item) : (item.raw?.fileMeta?.name || item.name);
    const fullPath = (parentPath + '/' + namePart).replace(/(^\/|\/\/$)/g, '');
    if (!confirm(`Delete ${item.isDir ? 'folder' : 'file'} "${item.name}"? This action cannot be undone.`)) return;
    try {
      setStatusMessage(`Deleting ${item.name}...`);
      await deleteItem(storageHandler, fullPath, !!item.isDir, item.raw);
      await refreshDirectory(parentPath);
      setStatusMessage('Deleted.');
    } catch (err) {
      logIfNotUserRejected(err, 'handleDeleteItem');
      if (await handleAccountMissing(err)) return;
      await showErrorAlert('Delete failed', err?.message || String(err));
      setStatusMessage('Delete failed: ' + (err?.message || String(err)));
    }
  };

  const handleRenameItem = async (item) => {
    if (!storageHandler || !item) return;
    const parentPath = pathStackIds.join('/');
    const oldFullPath = parentPath + '/' + (item.isDir ? (item.raw?.name || item.name) : (item.raw?.fileMeta?.name || item.name));
    const newName = prompt('New name for ' + item.name + ':', item.name);
    if (!newName || newName === item.name) return;
    try {
      console.debug('handleRenameItem: item.raw =', item.raw);
      setStatusMessage(`Renaming ${item.name} -> ${newName}...`);
      await renameItem(storageHandler, oldFullPath, newName, !!item.isDir, item.raw);
      await refreshDirectory(parentPath);
      setStatusMessage('Renamed.');
    } catch (err) {
      logIfNotUserRejected(err, 'handleRenameItem');
      if (await handleAccountMissing(err)) return;
      await showErrorAlert('Rename failed', err?.message || String(err));
      setStatusMessage('Rename failed: ' + (err?.message || String(err)));
    }
  };

  const handleDownload = async (item) => {
    if (!storageHandler) return;
    try {
      setDownloading(true);
      setDownloadProgress(0);
      setStatusMessage(`Downloading ${item.name}...`);
      
      const tracker = { progress: 0, chunks: [] };
      // Poll tracker for progress updates
      const progressInterval = setInterval(() => {
        if (typeof tracker.progress === 'number') {
          let p = tracker.progress;
          // If it seems to be a ratio (0-1), convert to percentage
          if (p <= 1) p *= 100;
          setDownloadProgress(Math.min(Math.round(p), 100));
        }
      }, 500);

      const fullPath = pathStackIds.join("/") + "/" + (item.raw?.fileMeta?.name || item.name);
      
      const blob = await downloadFile(storageHandler, fullPath, tracker, item.raw);
      
      clearInterval(progressInterval);
      setDownloadProgress(100);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setStatusMessage("Download complete!");
      setTimeout(() => {
        setDownloadProgress(0);
        setStatusMessage("");
      }, 3000);
    } catch (err) {
      console.error("Download error:", err);
      logIfNotUserRejected(err, 'handleDownload');
      if (await handleAccountMissing(err)) return;
      setStatusMessage("Download failed: " + (err?.message || String(err)));
    } finally {
      setDownloading(false);
    }
  };

  const handleShowInfo = (item) => {
    const fullPath = pathStackIds.join("/") + "/" + (item.raw?.fileMeta?.name || item.name);
    // Try to find properties in various places they might be
    const ulid = item.raw?.ulid || item.raw?.fileMeta?.ulid || item.raw?.cid || 'N/A';
    const merkle = item.raw?.merkle || item.raw?.merkleRoot || item.raw?.fileMeta?.merkle || item.raw?.fileMeta?.merkleRoot || 'N/A';
    const fid = item.raw?.fid || item.raw?.fileMeta?.fid || 'N/A';

    setSelectedItemInfo({
      ...item,
      fullPath: fullPath.replace(/^\/?s\//, ''),
      ulid,
      merkle,
      fid
    });
  };

  const handleOpenShareModal = async (item) => {
    setShareModalItem(item);
    setShareAddress('');
    setSharingLoading(true);
    try {
      const fullPath = pathStackIds.join("/") + "/" + (item.raw?.fileMeta?.name || item.name);
      const viewers = await getFileViewers(storageHandler, fullPath, item.raw);
      setFileViewers(viewers);
    } catch (err) {
      console.error('Failed to load viewers:', err);
      setFileViewers([]);
    } finally {
      setSharingLoading(false);
    }
  };

  const handleShareFile = async () => {
    if (!shareAddress || !shareModalItem || !storageHandler) return;
    
    // Validate Jackal address format
    if (!shareAddress.startsWith('jkl')) {
      await showErrorAlert('Invalid Address', 'Please enter a valid Jackal address (starts with "jkl")');
      return;
    }

    setSharingLoading(true);
    try {
      const fullPath = pathStackIds.join("/") + "/" + (shareModalItem.raw?.fileMeta?.name || shareModalItem.name);
      await shareFile(storageHandler, fullPath, shareAddress, shareModalItem.raw);
      
      // Refresh viewers list
      const viewers = await getFileViewers(storageHandler, fullPath, shareModalItem.raw);
      setFileViewers(viewers);
      setShareAddress('');
      setStatusMessage('File shared successfully!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      console.error('Share failed:', err);
      await showErrorAlert('Share Failed', err?.message || String(err));
    } finally {
      setSharingLoading(false);
    }
  };

  const handleUnshareFile = async (viewerAddress) => {
    if (!shareModalItem || !storageHandler) return;
    
    setSharingLoading(true);
    try {
      const fullPath = pathStackIds.join("/") + "/" + (shareModalItem.raw?.fileMeta?.name || shareModalItem.name);
      await unshareFile(storageHandler, fullPath, viewerAddress, shareModalItem.raw);
      
      // Refresh viewers list
      const viewers = await getFileViewers(storageHandler, fullPath, shareModalItem.raw);
      setFileViewers(viewers);
      setStatusMessage('Access revoked successfully!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      console.error('Unshare failed:', err);
      await showErrorAlert('Revoke Failed', err?.message || String(err));
    } finally {
      setSharingLoading(false);
    }
  };

  if (walletLoading) return <div className="container py-5 text-center"><div className="spinner-border text-primary" style={{width: '3rem', height: '3rem'}} role="status"><span className="visually-hidden">Loading...</span></div><p className="mt-3 text-muted">Loading wallet...</p></div>;
  if (!connected) return (
    <div className="container py-5 text-center">
      <div className="card border-0 shadow-lg mx-auto" style={{ maxWidth: '500px', borderRadius: '20px' }}>
        <div className="card-body p-5">
          <div className="mb-4" style={{ fontSize: '4rem' }}>🔐</div>
          <h2 className="mb-3">Wallet Not Connected</h2>
          <p className="text-muted mb-4">Please connect your wallet to access your Jackal Vault</p>
          <a href="/login" className="btn btn-lg px-5 py-3" style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontWeight: '600'
          }}>Connect Wallet</a>
        </div>
      </div>
    </div>
  );

  // Filter items by search query and active view
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    if (activeView === 'starred') {
      return isStarred(item);
    }
    // Add more filters for 'recent' and 'deleted' when implemented
    return true;
  });

  return (
    <div className="d-flex" style={{ height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div className="d-flex flex-column" style={{ 
        width: '240px', 
        borderRight: '1px solid var(--card-border)',
        background: 'var(--sidebar-bg)',
        flexShrink: 0
      }}>
        <div className="p-4">
          <div className="d-flex align-items-center gap-2 mb-4">
            <i className="bi bi-cloud-fill" style={{ fontSize: '1.5rem', color: '#6366f1' }}></i>
            <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '1.2rem' }}>Vault</div>
          </div>
          
          {/* Navigation */}
          <nav>
            <div className="mb-2">
              <button onClick={() => setActiveView('all')} className="d-flex align-items-center gap-2 px-3 py-2 text-decoration-none w-100 border-0" style={{ 
                borderRadius: '8px', 
                background: activeView === 'all' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: activeView === 'all' ? '#6366f1' : 'var(--text-secondary)',
                fontWeight: activeView === 'all' ? '600' : '400',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                <i className="bi bi-folder-fill"></i>
                <span>All Files</span>
              </button>
            </div>
            <div className="mb-2">
              <button onClick={() => setActiveView('starred')} className="d-flex align-items-center gap-2 px-3 py-2 text-decoration-none w-100 border-0" style={{ 
                borderRadius: '8px',
                background: activeView === 'starred' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: activeView === 'starred' ? '#6366f1' : 'var(--text-secondary)',
                fontWeight: activeView === 'starred' ? '600' : '400',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                <i className="bi bi-star-fill"></i>
                <span>Starred</span>
                {starredItems.length > 0 && <span className="badge rounded-pill" style={{ background: '#6366f1', color: 'white', fontSize: '0.7rem', marginLeft: 'auto' }}>{starredItems.length}</span>}
              </button>
            </div>
          </nav>
        </div>

        {/* Storage Widget in Sidebar */}
        <div className="mt-auto p-3">
          {storageInfo && storageInfo.info && (
            <div className="card border-0 shadow-sm" style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              borderRadius: '12px'
            }}>
              <div className="card-body p-3">
                <div className="text-white mb-2" style={{ fontSize: '0.75rem', fontWeight: '600' }}>STORAGE</div>
                <div className="position-relative mb-2" style={{ height: '6px', background: 'rgba(255,255,255,0.3)', borderRadius: '3px' }}>
                  <div style={{ 
                    width: `${Math.min((((storageInfo.info.spaceUsed || 0) / REDUNDANCY_FACTOR) / ((storageInfo.info.spaceAvailable || 0) / REDUNDANCY_FACTOR)) * 100, 100)}%`,
                    height: '100%',
                    background: 'white',
                    borderRadius: '3px',
                    transition: 'width 0.3s'
                  }}></div>
                </div>
                <div className="text-white" style={{ fontSize: '0.8rem' }}>
                  <strong>{formatBytes((storageInfo.info.spaceUsed || 0) / REDUNDANCY_FACTOR)}</strong> of <strong>{formatBytes((storageInfo.info.spaceAvailable || 0) / REDUNDANCY_FACTOR)}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow-1 d-flex flex-column" style={{ overflow: 'hidden' }}>
        {/* Top Bar */}
        <div className="border-bottom" style={{ background: 'var(--card-bg)', padding: '16px 24px', borderColor: 'var(--card-border)' }}>
          <div className="d-flex align-items-center gap-3">
            {/* Breadcrumb */}
            <div className="d-flex align-items-center gap-2 flex-grow-1">
              {pathStackIds.length > JACKAL_ROOT.length && (
                <button className="btn btn-sm btn-link text-decoration-none p-0" onClick={handleGoBack} disabled={loading} style={{ color: 'var(--text-secondary)' }}>
                  <i className="bi bi-arrow-left" style={{ fontSize: '1.2rem' }}></i>
                </button>
              )}
              <div className="d-flex align-items-center gap-1" style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                <span className="fw-semibold">{pathStack.slice(1).join(' / ') || 'Home'}</span>
              </div>
            </div>

            {/* Search Bar */}
            <div className="position-relative" style={{ width: '300px' }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search files..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ 
                  borderRadius: '8px',
                  border: '1px solid var(--input-border)',
                  paddingLeft: '36px',
                  fontSize: '0.9rem',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)'
                }}
              />
              <i className="bi bi-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', color: 'var(--text-secondary)' }}></i>
            </div>

            {/* View Toggle */}
            <div className="btn-group" role="group">
              <button 
                className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('grid')}
                style={{ borderRadius: '6px 0 0 6px', fontSize: '0.85rem' }}
              >
                <i className="bi bi-grid-3x3-gap-fill"></i>
              </button>
              <button 
                className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('list')}
                style={{ borderRadius: '0 6px 6px 0', fontSize: '0.85rem' }}
              >
                <i className="bi bi-list-ul"></i>
              </button>
            </div>

            {/* Action Buttons */}
            <button className="btn btn-sm btn-outline-primary" onClick={handleCreateFolder} disabled={loading} style={{ borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600' }}>
              + Folder
            </button>
            <div className="position-relative">
              <button className="btn btn-sm btn-primary" disabled={uploading || loading} style={{ borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600' }}>
                {uploading ? 'Uploading...' : '+ Upload'}
              </button>
              <input type="file" className="position-absolute top-0 start-0 opacity-0 w-100 h-100" onChange={handleFileUpload} disabled={uploading || loading} style={{ cursor: 'pointer' }} />
            </div>
          </div>
        </div>

        {/* Status Messages */}
        <div className="px-4 py-3">
          {statusMessage && (
            <div className="alert alert-info border-0 mb-0" style={{ borderRadius: '8px', fontSize: '0.9rem' }}>
              <div className="d-flex align-items-center gap-2">
                <div className="spinner-border spinner-border-sm" role="status"></div>
                <span>{statusMessage}</span>
              </div>
            </div>
          )}
        </div>
      
      {/* File Info Modal */}
      {selectedItemInfo && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-file-earmark-text-fill" style={{ color: '#3b82f6' }}></i>
                  {selectedItemInfo.name}
                </h5>
                <button type="button" className="btn-close" onClick={() => setSelectedItemInfo(null)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <small className="text-muted d-block mb-1">Type</small>
                  <div className="badge bg-primary">{selectedItemInfo.isDir ? 'Folder' : 'File'}</div>
                </div>
                <div className="mb-3">
                  <small className="text-muted d-block mb-1">Path</small>
                  <code className="d-block p-2 bg-light rounded">{selectedItemInfo.fullPath}</code>
                </div>
                {!selectedItemInfo.isDir && (
                  <div className="mb-3">
                    <small className="text-muted d-block mb-1">Size</small>
                    <strong>{formatBytes(selectedItemInfo.size)}</strong>
                  </div>
                )}
                <div className="mb-3">
                  <small className="text-muted d-block mb-1">ULID</small>
                  <code className="d-block p-2 bg-light rounded text-break small">{selectedItemInfo.ulid}</code>
                </div>
                {!selectedItemInfo.isDir && selectedItemInfo.merkle !== 'N/A' && (
                  <div className="mb-3">
                    <small className="text-muted d-block mb-1">Merkle Root</small>
                    <code className="d-block p-2 bg-light rounded text-break small">{selectedItemInfo.merkle}</code>
                  </div>
                )}
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedItemInfo(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModalItem && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-share-fill" style={{ color: '#8b5cf6' }}></i>
                  Share "{shareModalItem.name}"
                </h5>
                <button type="button" className="btn-close" onClick={() => setShareModalItem(null)}></button>
              </div>
              <div className="modal-body">
                {/* Add Viewer */}
                <div className="mb-4">
                  <label className="form-label fw-semibold" style={{ fontSize: '0.9rem' }}>Grant View Access</label>
                  <div className="input-group">
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="jkl1abc..." 
                      value={shareAddress}
                      onChange={(e) => setShareAddress(e.target.value)}
                      disabled={sharingLoading}
                      style={{ borderRadius: '8px 0 0 8px' }}
                    />
                    <button 
                      className="btn btn-primary" 
                      onClick={handleShareFile}
                      disabled={sharingLoading || !shareAddress}
                      style={{ borderRadius: '0 8px 8px 0' }}
                    >
                      {sharingLoading ? 'Sharing...' : 'Share'}
                    </button>
                  </div>
                  <small className="text-muted">Enter a Jackal address to grant read access</small>
                </div>

                {/* Current Viewers */}
                <div>
                  <label className="form-label fw-semibold mb-2" style={{ fontSize: '0.9rem' }}>Current Viewers</label>
                  {sharingLoading && fileViewers.length === 0 ? (
                    <div className="text-center py-3">
                      <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                      <p className="text-muted small mb-0 mt-2">Loading viewers...</p>
                    </div>
                  ) : fileViewers.length === 0 ? (
                    <div className="text-center py-3">
                      <p className="text-muted small mb-0">No viewers yet</p>
                    </div>
                  ) : (
                    <ul className="list-group">
                      {fileViewers.map((viewer, idx) => (
                        <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                          <code className="small text-truncate flex-grow-1" style={{ maxWidth: '70%' }}>{viewer}</code>
                          <button 
                            className="btn btn-sm btn-outline-danger" 
                            onClick={() => handleUnshareFile(viewer)}
                            disabled={sharingLoading}
                            style={{ fontSize: '0.75rem' }}
                          >
                            Revoke
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-secondary" onClick={() => setShareModalItem(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Progress Bars */}
        <div className="px-4">
          {uploading && uploadProgress > 0 && (
            <div className="mb-3">
              <div className="progress shadow-sm" style={{ height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div className="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style={{ 
                  width: `${uploadProgress}%`,
                  background: '#667eea'
                }} aria-valuenow={uploadProgress} aria-valuemin="0" aria-valuemax="100"></div>
              </div>
              <small className="text-muted" style={{ fontSize: '0.8rem' }}>Uploading: {uploadProgress}%</small>
            </div>
          )}
          {downloading && downloadProgress > 0 && (
            <div className="mb-3">
              <div className="progress shadow-sm" style={{ height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div className="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style={{ 
                  width: `${downloadProgress}%`,
                  background: '#667eea'
                }} aria-valuenow={downloadProgress} aria-valuemin="0" aria-valuemax="100"></div>
              </div>
              <small className="text-muted" style={{ fontSize: '0.8rem' }}>Downloading: {downloadProgress}%</small>
            </div>
          )}
        </div>

        {/* File List */}
        <div className="flex-grow-1" style={{ overflowY: 'auto', padding: '0 24px 24px' }} onDragOver={handleDragOver} onDrop={handleDropOnRoot}>
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary mb-3" role="status"></div>
              <p className="text-muted">Loading files...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-folder2-open" style={{ fontSize: '4rem', opacity: 0.2, color: 'var(--text-secondary)' }}></i>
              <p className="text-muted mb-0">{items.length === 0 ? 'This folder is empty' : 'No files match your search'}</p>
              {items.length === 0 && <small className="text-muted">Drag and drop files here or click Upload</small>}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="row g-3">
              {filteredItems.map((item, i) => {
                const isFolder = item.isDir || item.type === "folder";
                const parentPath = pathStackIds.join('/');
                const fullPath = (parentPath + '/' + (item.raw?.fileMeta?.name || item.name)).replace(/(^\/|\/\/$)/g, '');

                return (
                  <div key={i} className="col-6 col-md-4 col-lg-3 col-xl-2">
                    <div 
                      className="card border-0 h-100" 
                      style={{ 
                        background: isFolder && dragOverId === (item?.raw?.name || item.name) ? 'var(--hover-bg)' : 'transparent',
                        cursor: isFolder ? 'pointer' : 'default',
                        transition: 'all 0.2s'
                      }}
                      data-is-folder={isFolder ? "true" : "false"}
                      onDragOver={isFolder ? handleDragOver : undefined}
                      onDragEnter={isFolder ? () => handleDragEnterFolder(item) : undefined}
                      onDragLeave={isFolder ? () => handleDragLeaveFolder(item) : undefined}
                      onDrop={isFolder ? (e) => handleDropOnFolder(item, e) : undefined}
                      onDoubleClick={() => isFolder && handleOpenFolder(item)}
                    >
                      <div className="card-body p-2 text-center">
                        <div className="mb-2 d-flex align-items-center justify-content-center" style={{ height: '80px' }}>
                          {isFolder ? (
                            <i className="bi bi-folder-fill" style={{ fontSize: '3.5rem', color: '#f59e0b' }}></i>
                          ) : (
                            <div style={{ width: '60px', height: '60px' }}>
                              <FileThumbnail item={item} storageHandler={storageHandler} fullPath={fullPath} />
                            </div>
                          )}
                        </div>
                        <div className="text-truncate mb-1" style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                          {item.name}
                        </div>
                        {!isFolder && (
                          <small className="text-muted" style={{ fontSize: '0.75rem' }}>{formatBytes(item.size)}</small>
                        )}
                        <div className="d-flex gap-1 justify-content-center mt-2">
                          <button 
                            className="btn btn-sm p-1" 
                            onClick={(e) => { e.stopPropagation(); toggleStar(item); }}
                            style={{ fontSize: '1rem', border: 'none', background: 'transparent', color: isStarred(item) ? '#fbbf24' : '#d1d5db' }}
                            title={isStarred(item) ? 'Unstar' : 'Star'}
                          ><i className={`bi bi-star${isStarred(item) ? '-fill' : ''}`}></i></button>
                          {!isFolder && (
                            <button 
                              className="btn btn-sm p-1" 
                              onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                              disabled={downloading}
                              style={{ fontSize: '1rem', border: 'none', background: 'transparent', color: '#10b981' }}
                              title="Download"
                            ><i className="bi bi-download"></i></button>
                          )}
                          {!isFolder && (
                            <button 
                              className="btn btn-sm p-1" 
                              onClick={(e) => { e.stopPropagation(); handleOpenShareModal(item); }}
                              style={{ fontSize: '1rem', border: 'none', background: 'transparent', color: '#8b5cf6' }}
                              title="Share"
                            ><i className="bi bi-share-fill"></i></button>
                          )}
                          <div className="dropdown d-inline-block">
                            <button 
                              className="btn btn-sm p-1 dropdown-toggle" 
                              type="button"
                              data-bs-toggle="dropdown"
                              aria-expanded="false"
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: '1rem', border: 'none', background: 'transparent', color: '#6b7280' }}
                              title="More"
                            ><i className="bi bi-three-dots"></i></button>
                            <ul className="dropdown-menu dropdown-menu-end" onClick={(e) => e.stopPropagation()}>
                              <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); handleShowInfo(item); }}><i className="bi bi-info-circle me-2"></i>Info</a></li>
                              <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); handleRenameItem(item); }}><i className="bi bi-pencil me-2"></i>Rename</a></li>
                              <li><hr className="dropdown-divider" /></li>
                              <li><a className="dropdown-item text-danger" href="#" onClick={(e) => { e.preventDefault(); handleDeleteItem(item); }}><i className="bi bi-trash me-2"></i>Delete</a></li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="list-group list-group-flush">
              {filteredItems.map((item, i) => {
                const isFolder = item.isDir || item.type === "folder";
                const parentPath = pathStackIds.join('/');
                const fullPath = (parentPath + '/' + (item.raw?.fileMeta?.name || item.name)).replace(/(^\/|\/\/$)/g, '');

                return (
                  <div 
                    key={i} 
                    className="list-group-item border-0 d-flex align-items-center py-2 px-3"
                    style={{ 
                      background: isFolder && dragOverId === (item?.raw?.name || item.name) ? 'var(--hover-bg)' : 'transparent',
                      cursor: isFolder ? 'pointer' : 'default',
                      borderBottom: i < filteredItems.length - 1 ? '1px solid var(--card-border)' : 'none'
                    }}
                    data-is-folder={isFolder ? "true" : "false"}
                    onDragOver={isFolder ? handleDragOver : undefined}
                    onDragEnter={isFolder ? () => handleDragEnterFolder(item) : undefined}
                    onDragLeave={isFolder ? () => handleDragLeaveFolder(item) : undefined}
                    onDrop={isFolder ? (e) => handleDropOnFolder(item, e) : undefined}
                    onDoubleClick={() => isFolder && handleOpenFolder(item)}
                  >
                    <div style={{ width: '32px', height: '32px', marginRight: '12px' }}>
                      {isFolder ? (
                        <i className="bi bi-folder-fill" style={{ fontSize: '1.8rem', color: '#f59e0b' }}></i>
                      ) : (
                        <FileThumbnail item={item} storageHandler={storageHandler} fullPath={fullPath} />
                      )}
                    </div>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <div className="text-truncate" style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                        {item.name}
                      </div>
                    </div>
                    {!isFolder && (
                      <div className="text-muted me-3" style={{ fontSize: '0.85rem', width: '80px', textAlign: 'right' }}>
                        {formatBytes(item.size)}
                      </div>
                    )}
                    <div className="d-flex gap-1">
                      <button 
                        className="btn btn-sm p-1" 
                        onClick={(e) => { e.stopPropagation(); toggleStar(item); }}
                        style={{ fontSize: '1rem', border: 'none', background: 'transparent', color: isStarred(item) ? '#fbbf24' : '#d1d5db' }}
                        title={isStarred(item) ? 'Unstar' : 'Star'}
                      ><i className={`bi bi-star${isStarred(item) ? '-fill' : ''}`}></i></button>
                      {!isFolder && (
                        <button 
                          className="btn btn-sm p-1" 
                          onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                          disabled={downloading}
                          style={{ fontSize: '1rem', border: 'none', background: 'transparent', color: '#10b981' }}
                          title="Download"
                        ><i className="bi bi-download"></i></button>
                      )}
                      {!isFolder && (
                        <button 
                          className="btn btn-sm p-1" 
                          onClick={(e) => { e.stopPropagation(); handleOpenShareModal(item); }}
                          style={{ fontSize: '1rem', border: 'none', background: 'transparent', color: '#8b5cf6' }}
                          title="Share"
                        ><i className="bi bi-share-fill"></i></button>
                      )}
                      <div className="dropdown d-inline-block">
                        <button 
                          className="btn btn-sm p-1 dropdown-toggle" 
                          type="button"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: '1rem', border: 'none', background: 'transparent', color: '#6b7280' }}
                          title="More"
                        ><i className="bi bi-three-dots"></i></button>
                        <ul className="dropdown-menu dropdown-menu-end" onClick={(e) => e.stopPropagation()}>
                          <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); handleShowInfo(item); }}><i className="bi bi-info-circle me-2"></i>Info</a></li>
                          <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); handleRenameItem(item); }}><i className="bi bi-pencil me-2"></i>Rename</a></li>
                          <li><hr className="dropdown-divider" /></li>
                          <li><a className="dropdown-item text-danger" href="#" onClick={(e) => { e.preventDefault(); handleDeleteItem(item); }}><i className="bi bi-trash me-2"></i>Delete</a></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
