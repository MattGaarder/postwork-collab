<template>
    <div class="q-mt-md">
        <div class="text-subtitle2">All Comments (All Versions)</div>
        <q-list bordered dense v-if="comments.length">
            <q-item v-for="c in comments" :key="c.id" :id="`cmt-${c.id}`">
                <q-item-section>
                    <div class="text-caption text-grey">
                        <strong>Version {{ c.versionId }}</strong> ·
                        Lines {{ c.line === c.endLine || !c.endLine ? c.line : `${c.line}–${c.endLine}` }}
                    </div>
                    <div class="text-body2">{{ c.content }}</div>
                    <div class="text-caption text-grey" style="margin-top: 4px;">
                        by {{ c.author?.name || c.author?.email || "Anonymous" }}
                        — {{ new Date(c.createdAt).toLocaleString() }}
                    </div>

                    <!-- Original Code Display -->
                    <div v-if="c.originalCode" class="q-mt-sm">
                        <q-expansion-item dense dense-toggle expand-separator icon="code" label="Original Code"
                            header-class="text-caption">
                            <q-card>
                                <q-card-section class="bg-grey-10">
                                    <pre class="text-caption"
                                        style="margin: 0; color: #e5e7eb; font-family: 'Courier New', monospace;">{{ c.originalCode }}</pre>
                                </q-card-section>
                            </q-card>
                        </q-expansion-item>
                    </div>

                    <!-- Action Buttons -->
                    <div class="row q-mt-sm q-gutter-sm">
                        <q-btn size="sm" dense color="primary" icon="visibility" label="View"
                            @click="$emit('view', c)" />
                        <q-btn size="sm" dense outline color="positive" icon="check" label="Resolve"
                            @click.stop="$emit('resolve', c.id)" />
                        <q-btn size="sm" dense outline color="secondary" icon="auto_fix_high" label="Apply Change"
                            disable @click.stop="$emit('apply', c)">
                            <q-tooltip>Coming soon: Apply suggested code changes</q-tooltip>
                        </q-btn>
                    </div>
                </q-item-section>
            </q-item>
        </q-list>
        <q-item v-else>
            <q-item-section>No comments yet.</q-item-section>
        </q-item>
    </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

defineProps({
    comments: {
        type: Array as PropType<any[]>,
        required: true
    }
})

defineEmits(['view', 'resolve', 'apply'])
</script>
