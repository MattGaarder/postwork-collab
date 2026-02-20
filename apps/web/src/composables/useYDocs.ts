// src/composables/useYDocs.ts
import { ref, watch, onBeforeUnmount } from 'vue';
import type { Ref } from 'vue';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const WS_URL = 'ws://localhost:1234';

/**
 * useYDoc - Reactive Yjs composable.
 *
 * Accepts a reactive room ref. When the room changes (e.g. version navigation),
 * the old provider is destroyed and a new one is created for the new room.
 * This ensures all users in the same room stay in sync.
 */
export function useYDoc(roomRef: Ref<string> | string) {
    const doc = new Y.Doc();
    const status = ref<'connecting' | 'connected' | 'disconnected'>('connecting');

    let provider: WebsocketProvider | null = null;

    function connect(roomId: string) {
        // Destroy old provider if it exists
        if (provider) {
            provider.destroy();
            provider = null;
        }

        status.value = 'connecting';
        provider = new WebsocketProvider(WS_URL, roomId, doc, { connect: true });

        provider.on('status', (e: { status: 'connected' | 'disconnected' }) => {
            status.value = e.status;
        });
    }

    // If roomRef is a reactive Ref, watch it for changes
    if (typeof roomRef === 'string') {
        connect(roomRef);
    } else {
        // Initial connection
        connect(roomRef.value);
        // Watch for room changes (e.g. version navigation)
        watch(roomRef, (newRoom) => {
            connect(newRoom);
        });
    }

    onBeforeUnmount(() => {
        provider?.destroy();
        doc.destroy();
    });

    return {
        doc,
        status,
        get provider() { return provider; }
    };
}
