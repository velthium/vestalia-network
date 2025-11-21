// src/app/vault/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { showErrorAlert } from "@/utils/alerts/error";
import {
  loadDirectoryContents,
  createNewFolder,
  downloadFile,
  uploadFile,
  deleteItem,
  renameItem,
} from "@/lib/jackalActions";

const JACKAL_ROOT = ["s", "Home"];
const JACKAL_ROOT_STRING = JACKAL_ROOT.join("/");

export default function Vault() {
  const [storageHandler, setStorageHandler] = useState(null);
  const [items, setItems] = useState([]);
  // `pathStack` holds human-friendly labels for the breadcrumb UI
  const [pathStack, setPathStack] = useState(JACKAL_ROOT);
  // `pathStackIds` holds the actual path identifiers used by the StorageHandler (may be ULIDs)
  const [pathStackIds, setPathStackIds] = useState(JACKAL_ROOT);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [dragOverId, setDragOverId] = useState(null);

  const { connected, loading: walletLoading, storage } = useWallet();
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);

  const handleAccountMissing = async (err) => {
    const msg = err?.message || String(err || "");
    if (msg.includes("does not exist on chain") || msg.includes("Send some tokens")) {
      setBlocked(true);

      try {
        await showErrorAlert(
          "Account empty",
          "This wallet has no JACKAL (JKL). Please send some JKL tokens to your address before using the Vault. You will be redirected to Pricing."
        );
      } catch (e) {
        console.warn("showErrorAlert failed:", e);
      }

      try {
        router.push("/pricing");
      } catch (e) {
        window.location.href = "/pricing";
      }

      return true;
    }

    return false;
  };

  // Init Jackal storage once wallet is connected
  useEffect(() => {
    const init = async () => {
      if (!connected || !storage) return;

      try {
        setStatusMessage("Initializing Jackal storage...");
        setLoading(true);

        await storage.upgradeSigner();
        await storage.initStorage();

        setStorageHandler(storage);
        // Pass the freshly-initialized storage directly to refreshDirectory (use id stack)
        await refreshDirectory(pathStackIds.join('/'), storage);

        setStatusMessage("");
      } catch (err) {
        console.error(err);
        // If it's the account-empty error, redirect to pricing (block the page)
        if (await handleAccountMissing(err)) return;

        setStatusMessage("Error initializing storage: " + (err?.message || String(err)));
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, storage]);

  const refreshDirectory = async (path, handler = storageHandler) => {
    if (!handler) return;

    try {
      setLoading(true);
      setStatusMessage(`Loading ${path}...`);

      // Load and normalize directory contents via the standard loader
      const normalized = await loadDirectoryContents(handler, path);
      setItems(normalized);
      setStatusMessage("");
    } catch (err) {
      console.error(err);
      // If it's the account-empty error, redirect to pricing (block the page)
      if (await handleAccountMissing(err)) return;

      setStatusMessage("Error loading directory: " + (err?.message || String(err)));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFolder = async (item) => {
    // item is the normalized object { name, isDir, raw }
    const id = item?.raw?.name || item.name;
    const label = item?.raw?.whoAmI || item.name;

    const newIds = [...pathStackIds, id];
    const newLabels = [...pathStack, label];

    setPathStackIds(newIds);
    setPathStack(newLabels);

    await refreshDirectory(newIds.join("/"));
  };

  const handleGoBack = async () => {
    if (pathStackIds.length <= JACKAL_ROOT.length) return;
    const newIds = [...pathStackIds];
    const newLabels = [...pathStack];
    newIds.pop();
    newLabels.pop();
    setPathStackIds(newIds);
    setPathStack(newLabels);
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
      console.error(err);
      if (await handleAccountMissing(err)) return;

      setStatusMessage("Error creating folder: " + (err?.message || String(err)));
    }
  };

  // Drag & Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnterFolder = (item) => {
    const id = item?.raw?.name || item.name;
    setDragOverId(id);
  };

  const handleDragLeaveFolder = (item) => {
    setDragOverId(null);
  };

  const handleDropOnFolder = async (item, e) => {
    e.preventDefault();
    setDragOverId(null);
    if (!storageHandler) return;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const id = item?.raw?.name || item.name;
    const parentPath = pathStackIds.join('/') + '/' + id;

    try {
      setUploading(true);
      setStatusMessage(`Uploading ${files.length} file(s) to ${item.name}...`);
      for (let i = 0; i < files.length; i++) {
        // upload each file sequentially
        // eslint-disable-next-line no-await-in-loop
        await uploadFile(storageHandler, files[i], parentPath);
      }
      await refreshDirectory(parentPath);
      setStatusMessage('Upload complete!');
    } catch (err) {
      console.error(err);
      if (await handleAccountMissing(err)) return;
      setStatusMessage('Upload failed: ' + (err?.message || String(err)));
    } finally {
      setUploading(false);
    }
  };

  const handleDropOnRoot = async (e) => {
    e.preventDefault();
    if (!storageHandler) return;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const parentPath = pathStackIds.join('/');

    try {
      setUploading(true);
      setStatusMessage(`Uploading ${files.length} file(s)...`);
      for (let i = 0; i < files.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        await uploadFile(storageHandler, files[i], parentPath);
      }
      await refreshDirectory(parentPath);
      setStatusMessage('Upload complete!');
    } catch (err) {
      console.error(err);
      if (await handleAccountMissing(err)) return;
      setStatusMessage('Upload failed: ' + (err?.message || String(err)));
    } finally {
      setUploading(false);
    }
  };

  

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !storageHandler) return;

    try {
      setUploading(true);
      setStatusMessage(`Uploading ${file.name}...`);

      const parentPath = pathStackIds.join("/");
      await uploadFile(storageHandler, file, parentPath);

      await refreshDirectory(parentPath);
      setStatusMessage("Upload complete!");
    } catch (err) {
      console.error(err);
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
    const fullPath = parentPath + '/' + (item.isDir ? (item.raw?.name || item.name) : (item.raw?.fileMeta?.name || item.name));

    const ok = confirm(`Delete ${item.isDir ? 'folder' : 'file'} "${item.name}"? This action cannot be undone.`);
    if (!ok) return;

    try {
      setStatusMessage(`Deleting ${item.name}...`);
      await deleteItem(storageHandler, fullPath, !!item.isDir);
      await refreshDirectory(parentPath);
      setStatusMessage('Deleted.');
    } catch (err) {
      console.error(err);
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
      // Log raw metadata to help debugging if rename fails
      // eslint-disable-next-line no-console
      console.debug('handleRenameItem: item.raw =', item.raw);
      setStatusMessage(`Renaming ${item.name} -> ${newName}...`);
        await renameItem(storageHandler, oldFullPath, newName, !!item.isDir, item.raw);
      await refreshDirectory(parentPath);
      setStatusMessage('Renamed.');
    } catch (err) {
      console.error(err);
      if (await handleAccountMissing(err)) return;
      await showErrorAlert('Rename failed', err?.message || String(err));
      setStatusMessage('Rename failed: ' + (err?.message || String(err)));
    }
  };

  const handleDownload = async (item) => {
    try {
      setStatusMessage(`Downloading ${item.name}...`);

      const fullPath = pathStackIds.join("/") + "/" + (item.raw?.fileMeta?.name || item.name);
      const blob = await downloadFile(storageHandler, fullPath);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage("Download complete!");
    } catch (err) {
      setStatusMessage("Download failed: " + err.message);
    }
  };

  // ---- Render states ----
  if (walletLoading) {
    return <div className="container py-5 text-center">Loading wallet...</div>;
  }

  if (!connected) {
    return (
      <div className="container py-5 text-center">
        <h1>🔐 Please connect your wallet first</h1>
        <a href="/login" className="btn btn-primary mt-4">
          Go to Login
        </a>
      </div>
    );
  }

  return (
    <div
      className="container py-5"
      onDragOver={handleDragOver}
      onDrop={handleDropOnRoot}
      onDragEnter={(e) => e.preventDefault()}
      onDragLeave={(e) => e.preventDefault()}
    >
      <h1>☁️ My Jackal Vault</h1>

      {statusMessage && <div className="alert alert-info">{statusMessage}</div>}

      <div className="d-flex gap-2 my-3" onDragOver={handleDragOver} onDrop={handleDropOnRoot}>
        <button
          className="btn btn-secondary"
          onClick={handleGoBack}
          disabled={pathStackIds.length <= JACKAL_ROOT.length || loading}
        >
          ⬅ Back
        </button>

        <button className="btn btn-primary" onClick={handleCreateFolder} disabled={loading}>
          + New Folder
        </button>

        <div className="btn btn-success position-relative overflow-hidden">
          {uploading ? "Uploading..." : "+ Upload File"}
          <input
            type="file"
            className="position-absolute top-0 start-0 opacity-0 w-100 h-100"
            onChange={handleFileUpload}
            disabled={uploading || loading}
          />
        </div>

        
      </div>

      <h5>
        Path:
        <code className="bg-light p-1 rounded mx-2">
          {pathStack.slice(1).join(" / ")}
        </code>
      </h5>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul className="list-group mt-4">
          {items.length === 0 ? (
            <li className="list-group-item text-muted">This folder is empty.</li>
          ) : (
            items.map((item, i) => {
              const isFolder = item.isDir || item.type === "folder";

              return (
                    <li
                      key={i}
                      className={`list-group-item d-flex justify-content-between align-items-center ${isFolder && dragOverId === (item?.raw?.name || item.name) ? 'bg-light' : ''}`}
                      onDragOver={isFolder ? handleDragOver : undefined}
                      onDragEnter={isFolder ? () => handleDragEnterFolder(item) : undefined}
                      onDragLeave={isFolder ? () => handleDragLeaveFolder(item) : undefined}
                      onDrop={isFolder ? (e) => handleDropOnFolder(item, e) : undefined}
                    >
                      <div
                        style={{ cursor: isFolder ? "pointer" : "default" }}
                        onClick={() => isFolder && handleOpenFolder(item)}
                        className="d-flex align-items-center gap-2"
                      >
                        <span>{isFolder ? "📁" : "📄"}</span>
                        <strong>{item.name}</strong>

                        {!isFolder && (
                          <small className="text-muted ms-2">
                            {(item.size / (1024 * 1024)).toFixed(2)} MB
                          </small>
                        )}
                      </div>

                      {!isFolder && (
                        <button
                          className="btn btn-sm btn-outline-dark"
                          onClick={() => handleDownload(item)}
                        >
                          ⬇
                        </button>
                      )}
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => handleRenameItem(item)}
                        >
                          🖉
                        </button>

                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteItem(item)}
                        >
                          🗑
                        </button>
                      </div>
                    </li>
              );
            })
          )}
        </ul>
      )}

      
    </div>
  );
}
