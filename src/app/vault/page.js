"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { showErrorAlert } from "@/utils/alerts/error";
import { loadDirectoryContents, createNewFolder, downloadFile, uploadFile, deleteItem, renameItem, safeUpgradeSigner, getStorageStatus } from "@/lib/jackalActions";

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
  
  const radius = 80;
  const stroke = 10;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="card mb-4 border-0 shadow-sm" style={{ backgroundColor: '#EEF2FF', borderRadius: '24px', maxWidth: '320px', margin: '0 auto' }}>
      <div className="card-body d-flex flex-column align-items-center justify-content-center py-3">
        <div className="position-relative d-flex align-items-center justify-content-center">
          <svg
            height={radius * 2}
            width={radius * 2}
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle
              stroke="white"
              strokeWidth={stroke}
              fill="transparent"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            <circle
              stroke="#6366f1" 
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
              strokeLinecap="round"
              fill="transparent"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
          </svg>
          <div className="position-absolute text-center">
            <div className="text-secondary mb-1" style={{ fontSize: '0.9rem', fontWeight: '500' }}>Available</div>
            <div className="text-dark fw-bold" style={{ fontSize: '1.4rem' }}>{formatBytes(available)}</div>
          </div>
        </div>
        <div className="mt-2 text-secondary" style={{ fontSize: '0.9rem' }}>
          <span className="fw-bold text-dark">{percentage.toFixed(1)}%</span> used
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

  if (loading) return <span className="spinner-border spinner-border-sm text-secondary" role="status" style={{width: '24px', height: '24px'}}></span>;
  if (error) {
    return <span title="Error loading thumbnail. The file might be unavailable." onClick={(e) => { e.stopPropagation(); load(); }} style={{cursor: 'pointer'}}>⚠️</span>;
  }
  if (url) return <img src={url} alt="thumbnail" style={{width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px'}} />;
  return <span>📄</span>;
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

  const logIfNotUserRejected = (err, prefix = '') => { const msg = err?.message || String(err || ''); if (/request rejected|user rejected/i.test(msg)) console.debug(prefix, 'user rejected signer request:', msg); else console.error(prefix, err); };

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

  if (walletLoading) return <div className="container py-5 text-center">Loading wallet...</div>;
  if (!connected) return <div className="container py-5 text-center"><h1>🔐 Please connect your wallet first</h1><a href="/login" className="btn btn-primary mt-4">Go to Login</a></div>;

  return (
    <div className="container py-5" onDragOver={handleDragOver} onDrop={handleDropOnRoot}>
      <h1>☁️ My Jackal Vault</h1>
      
      {storageInfo && storageInfo.info && (
        <StorageWidget 
          used={(storageInfo.info.spaceUsed || 0) / REDUNDANCY_FACTOR} 
          total={(storageInfo.info.spaceAvailable || 0) / REDUNDANCY_FACTOR} 
        />
      )}

      {statusMessage && <div className="alert alert-info">{statusMessage}</div>}
      
      {selectedItemInfo && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">File Info: {selectedItemInfo.name}</h5>
                <button type="button" className="btn-close" onClick={() => setSelectedItemInfo(null)}></button>
              </div>
              <div className="modal-body">
                <p><strong>Name:</strong> {selectedItemInfo.name}</p>
                <p><strong>Type:</strong> {selectedItemInfo.isDir ? 'Folder' : 'File'}</p>
                <p><strong>Path:</strong> {selectedItemInfo.fullPath}</p>
                {!selectedItemInfo.isDir && <p><strong>Size:</strong> {(selectedItemInfo.size / (1024 * 1024)).toFixed(2)} MB</p>}
                <p><strong>ULID:</strong> <small className="text-muted">{selectedItemInfo.ulid}</small></p>
                {!selectedItemInfo.isDir && selectedItemInfo.merkle !== 'N/A' && (
                  <p><strong>Merkle Root:</strong> <small className="text-muted text-break">{selectedItemInfo.merkle}</small></p>
                )}
                {!selectedItemInfo.isDir && selectedItemInfo.fid !== 'N/A' && (
                  <p><strong>FID:</strong> <small className="text-muted text-break">{selectedItemInfo.fid}</small></p>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedItemInfo(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {uploading && uploadProgress > 0 && (
        <div className="mb-3">
          <div className="progress" style={{ height: '25px' }}>
            <div className="progress-bar progress-bar-striped progress-bar-animated bg-success" role="progressbar" style={{ width: `${uploadProgress}%` }} aria-valuenow={uploadProgress} aria-valuemin="0" aria-valuemax="100">Upload: {uploadProgress}%</div>
          </div>
        </div>
      )}
      {downloading && downloadProgress > 0 && (
        <div className="mb-3">
          <div className="progress" style={{ height: '25px' }}>
            <div className="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style={{ width: `${downloadProgress}%`, backgroundColor: '#E0CCFF', color: 'black' }} aria-valuenow={downloadProgress} aria-valuemin="0" aria-valuemax="100">Download: {downloadProgress}%</div>
          </div>
        </div>
      )}
      <div className="d-flex gap-2 my-3">
        {pathStackIds.length > JACKAL_ROOT.length && (
          <button className="btn btn-secondary" onClick={handleGoBack} disabled={loading}>⬅ Back</button>
        )}
        <button className="btn btn-primary" onClick={handleCreateFolder} disabled={loading}>+ New Folder</button>
        <div className="btn btn-success position-relative overflow-hidden">{uploading ? "Uploading..." : "+ Upload File"}<input type="file" className="position-absolute top-0 start-0 opacity-0 w-100 h-100" onChange={handleFileUpload} disabled={uploading || loading} /></div>
      </div>
      <h5>Path:<code className="bg-light p-1 rounded mx-2">{pathStack.slice(1).join(" / ")}</code></h5>
      {loading ? <p>Loading...</p> : (
        <ul className="list-group mt-4">
          {items.length === 0 ? <li className="list-group-item text-muted">This folder is empty.</li> : items.map((item, i) => {
            const isFolder = item.isDir || item.type === "folder";
            const parentPath = pathStackIds.join('/');
            const fullPath = (parentPath + '/' + (item.raw?.fileMeta?.name || item.name)).replace(/(^\/|\/\/$)/g, '');

            return (
              <li key={i} className={`list-group-item d-flex justify-content-between align-items-center ${isFolder && dragOverId === (item?.raw?.name || item.name) ? 'bg-light' : ''}`} data-is-folder={isFolder ? "true" : "false"} onDragOver={isFolder ? handleDragOver : undefined} onDragEnter={isFolder ? () => handleDragEnterFolder(item) : undefined} onDragLeave={isFolder ? () => handleDragLeaveFolder(item) : undefined} onDrop={isFolder ? (e) => handleDropOnFolder(item, e) : undefined}>
                <div style={{ cursor: isFolder ? "pointer" : "default" }} onClick={() => isFolder && handleOpenFolder(item)} className="d-flex align-items-center gap-2">
                  {isFolder ? <span>📁</span> : <FileThumbnail item={item} storageHandler={storageHandler} fullPath={fullPath} />}
                  <strong>{item.name}</strong>
                  {!isFolder && <small className="text-muted ms-2">{(item.size / (1024 * 1024)).toFixed(2)} MB</small>}
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-outline-info" onClick={() => handleShowInfo(item)}>ℹ</button>
                  {!isFolder && <button className="btn btn-sm btn-outline-primary" onClick={() => handleDownload(item)} disabled={downloading}>⬇</button>}
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => handleRenameItem(item)}>🖉</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteItem(item)}>🗑</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
