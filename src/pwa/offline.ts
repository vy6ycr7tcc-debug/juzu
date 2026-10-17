/**
 * Module: src/pwa/offline.ts
 * Responsibility: Client-side PWA controller for offline gameplay,
 * Service Worker lifecycle, asset precaching, storage estimation,
 * and offline status notifications.
 */

export interface OfflineDownloadProgress {
  progress: number;
  completed: number;
  total: number;
  currentAsset?: string;
}

export interface OfflineStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isOffline: boolean;
  isReady: boolean;
  cachedCount: number;
  totalCount: number;
  storageUsedMB: number;
  storageQuotaMB: number;
}

class OfflineManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isDownloading: boolean = false;
  private listeners: Set<(status: OfflineStatus) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.notifyListeners());
      window.addEventListener('offline', () => this.notifyListeners());
    }
  }

  public async register(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/juzu/sw.js', {
        scope: '/juzu/',
      });

      // Handle worker ready or update
      if (this.registration.installing) {
        this.registration.installing.addEventListener('statechange', (e: any) => {
          if (e.target?.state === 'activated') {
            this.notifyListeners();
          }
        });
      }

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.notifyListeners();
      });

      this.notifyListeners();
      return true;
    } catch (err) {
      console.warn('[OfflineManager] SW registration error:', err);
      return false;
    }
  }

  public onStatusChange(callback: (status: OfflineStatus) => void): () => void {
    this.listeners.add(callback);
    this.getStatus().then(callback);
    return () => this.listeners.delete(callback);
  }

  private async notifyListeners(): Promise<void> {
    const status = await this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (err) {
        console.error(err);
      }
    }
  }

  public async getStatus(): Promise<OfflineStatus> {
    const isSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
    let isRegistered = !!this.registration || (isSupported && !!navigator.serviceWorker.controller);

    let cachedCount = 0;
    let totalCount = 0;
    let isReady = false;

    if (isSupported && navigator.serviceWorker.controller) {
      try {
        const res = await this.sendMessage<{ total: number; cached: number; isReady: boolean }>({
          type: 'GET_OFFLINE_STATUS',
        });
        if (res) {
          cachedCount = res.cached;
          totalCount = res.total;
          isReady = res.isReady;
        }
      } catch {
        // Fallback
      }
    }

    let storageUsedMB = 0;
    let storageQuotaMB = 0;
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        storageUsedMB = Math.round(((est.usage || 0) / (1024 * 1024)) * 10) / 10;
        storageQuotaMB = Math.round(((est.quota || 0) / (1024 * 1024)) * 10) / 10;
      } catch {
        // Fallback
      }
    }

    return {
      isSupported,
      isRegistered,
      isOffline,
      isReady,
      cachedCount,
      totalCount,
      storageUsedMB,
      storageQuotaMB,
    };
  }

  public async downloadForOffline(
    onProgress?: (progress: OfflineDownloadProgress) => void
  ): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.onLine) {
      throw new Error('Cannot download assets while offline.');
    }

    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      await this.register();
      // Wait briefly for controller
      await new Promise((r) => setTimeout(r, 400));
    }

    const worker = navigator.serviceWorker.controller;
    if (!worker) {
      throw new Error('Service Worker not yet active. Please refresh and try again.');
    }

    if (this.isDownloading) return false;
    this.isDownloading = true;

    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();

      channel.port1.onmessage = (event) => {
        const data = event.data;
        if (!data) return;

        if (data.type === 'PROGRESS') {
          onProgress?.({
            progress: data.progress,
            completed: data.completed,
            total: data.total,
            currentAsset: data.currentAsset,
          });
        } else if (data.type === 'COMPLETE') {
          this.isDownloading = false;
          this.notifyListeners();
          resolve(true);
        } else if (data.type === 'ERROR') {
          this.isDownloading = false;
          reject(new Error(data.error || 'Failed to download offline assets.'));
        }
      };

      worker.postMessage({ type: 'DOWNLOAD_OFFLINE' }, [channel.port2]);
    });
  }

  public async clearOfflineData(): Promise<boolean> {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      return false;
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (event.data?.type === 'CLEARED') {
          this.notifyListeners();
          resolve(true);
        } else {
          resolve(false);
        }
      };
      navigator.serviceWorker.controller!.postMessage({ type: 'CLEAR_OFFLINE' }, [channel.port2]);
    });
  }

  private sendMessage<T>(message: any): Promise<T | null> {
    return new Promise((resolve) => {
      const worker = navigator.serviceWorker?.controller;
      if (!worker) return resolve(null);

      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        resolve(event.data as T);
      };
      worker.postMessage(message, [channel.port2]);

      // Timeout safety
      setTimeout(() => resolve(null), 3000);
    });
  }
}

export const offlineManager = new OfflineManager();
