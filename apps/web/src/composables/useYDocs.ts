// src/composables/useYDocs.ts
import { ref, onBeforeUnmount } from 'vue';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export function useYDoc(roomId: string, wsUrl = 'ws://localhost:1234') {
    const doc = new Y.Doc();

    const status = ref<'connecting' | 'connected' | 'disconnected'>('connecting');
9
    const provider = new WebsocketProvider(wsUrl, roomId, doc);
    // useYDocs.ts:11 WebSocket connection to 'ws://localhost:1234/project-5-v-18' failed: 

    provider.on('status', (e: { status: 'connected' | 'disconnected' }) => {
        status.value = e.status;
    });

    onBeforeUnmount(() => {
        provider.destroy();
        doc.destroy();
    });
    return { 
        doc, 
        provider, 
        status 
    }
}

// // useYDocs.ts (example)
// import * as Y from 'yjs'
// import { WebsocketProvider } from 'y-websocket'

// export function useYDoc(room: string) {
//   const doc = new Y.Doc()
//   const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:1234'
//   const provider = new WebsocketProvider(WS_URL, room, doc, { connect: true })

//   return {
//     doc,
//     status: provider.wsconnected ? 'connected' : 'disconnected',
//     provider
//   }
// }