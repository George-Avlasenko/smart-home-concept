import { useEffect, useRef, useState, useCallback } from 'react';
import { forceLogoutBlocked, isAccountBlockedResponse } from '../utils/accountBlocked';

interface SSEEvent {
  type: string;
  data: any;
  timestamp: string;
}

interface UseSSEOptions {
  onMessage?: (event: SSEEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
  /** Подключаться только когда true. Сначала загружаем данные, потом садимся на подписку. */
  enabled?: boolean;
}

export const useSSE = (options: UseSSEOptions = {}) => {
  const { enabled = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;
  const isConnectingRef = useRef(false);
  
  // Сохраняем колбэки в ref, чтобы избежать переподключений
  const callbacksRef = useRef(options);
  useEffect(() => {
    callbacksRef.current = options;
  }, [options]);

  const connect = useCallback(() => {
    if (!enabled) return;
    if (isConnectingRef.current) {
      return; // Уже подключаемся
    }

    const token = sessionStorage.getItem('token');
    if (!token) {
      console.warn('[SSE] No token found, cannot connect to SSE.');
      return;
    }

    // Закрываем предыдущее соединение
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Очищаем таймер переподключения
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    isConnectingRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (import.meta.env.DEV) {
      console.log('[SSE] Connecting to /api/events/subscribe...');
    }

    fetch('/api/events/subscribe', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 403) {
            let data: unknown = null;
            try {
              data = await response.clone().json();
            } catch {
              /* ignore */
            }
            if (isAccountBlockedResponse(403, data)) {
              forceLogoutBlocked();
              return;
            }
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        if (import.meta.env.DEV) console.log('[SSE] Connected successfully');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        isConnectingRef.current = false;
        callbacksRef.current.onOpen?.();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            if (controller.signal.aborted) {
              break;
            }

            const { done, value } = await reader.read();

            if (done) {
              console.log('[SSE] Stream ended normally');
              break;
            }

            if (value) {
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(':')) {
                  continue;
                }

                if (trimmed.startsWith('data: ')) {
                  try {
                    const jsonStr = trimmed.substring(6).trim();
                    if (jsonStr) {
                      const data = JSON.parse(jsonStr);
                      if (data.type !== 'connected' && data.type !== 'ping') {
                        setLastEventAt(Date.now());
                        if (import.meta.env.DEV) {
                          console.log('[SSE] Event received:', data.type, data.data);
                        }
                        callbacksRef.current.onMessage?.(data);
                      }
                    }
                  } catch (e) {
                    console.warn('[SSE] Error parsing message:', e);
                  }
                }
              }
            }
          }
        } catch (streamError: any) {
          if (streamError.name !== 'AbortError') {
            throw streamError;
          }
        } finally {
          setIsConnected(false);
          callbacksRef.current.onClose?.();
          isConnectingRef.current = false;
        }
      })
      .catch((error: any) => {
        isConnectingRef.current = false;
        
        if (error.name === 'AbortError') {
          return;
        }

        console.warn('[SSE] Connection error, will reconnect:', error.message || error);
        setIsConnected(false);
        callbacksRef.current.onError?.(error as Event);
        callbacksRef.current.onClose?.();
        
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = reconnectDelay * Math.pow(2, reconnectAttempts.current - 1);
          if (import.meta.env.DEV) {
            console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})...`);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('[SSE] Max reconnect attempts reached');
        }
      });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsConnected(false);
      isConnectingRef.current = false;
    };
  }, [connect, enabled]);

  return { isConnected, lastEventAt };
};

