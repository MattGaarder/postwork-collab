<template>
    <div class="row q-gutter-md">
        <div class="col-12">
            <div class="editorEl">

            </div>
        </div>
        <div class="col-12">
            <q-list>
                <q-item-label header>Comments</q-item-label>
                <template v-for="t in threads" :key="t.id">
                    <q-item>
                        <q-item-section>
                            <div class="text-caption">
                                Line: {{ t.line }} - {{ t.author }}
                            </div>
                            <div>{{ t.content }}</div>
                        </q-item-section>
                        
                    </q-item> 
                </template>
            </q-list>
        </div>
    </div>
</template>
<script setup>

</script>