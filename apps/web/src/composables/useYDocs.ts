// src/composables/useYDocs.ts
import { ref, onBeforeUnmount } from 'vue';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export function useYDoc(roomId: string, wsUrl = 'ws://localhost:1234') {
    const doc = new Y.Doc();

    const status = ref<'connecting' | 'connected' | 'disconnected'>('connecting');
9
    const provider = new WebsocketProvider(wsUrl, roomId, doc);

    provider.on('status', (e: { status: 'connected' | 'disconnected' }) => {
        status.value = e.status;
    });

    onBeforeUnmount(() => {
        provider.destroy();
        doc.destroy();
    });
    return { doc, provider, status }
}
