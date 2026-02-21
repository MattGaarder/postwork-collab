import { ref, computed, unref } from 'vue';
import type { Ref } from 'vue';
import { api } from '../lib/http';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';

const enumToMonaco = (lang?: string) => {
    switch(lang) {
        case 'JAVASCRIPT':  return 'javascript'
        case 'PYTHON':      return 'python'
        case 'JAVA':        return 'java'
        default:            return 'plaintext'
    }
}

export function useVersion(projectIdRef: Ref<number> | number, versionIdRef: Ref<number> | number) {
    const router = useRouter();
    const $q = useQuasar();

    const projectId = computed(() => unref(projectIdRef));
    const versionId = computed(() => unref(versionIdRef));
    // unref is a utility that basically means "Give me the value, I don't care if it's in a box or not."
    // If you pass it a Ref (a box): it returns the contents of the box (box.value).
    // If you pass it a plain value: it just returns that value.

    const code = ref('');
    const language = ref('plaintext');
    const createdAt = ref<string | null>(null);
    const updatedAt = ref<string | null>(null);
    const isLoading = ref(false);
    const errorMsg = ref('');

    async function refresh() {
        if (!projectId.value || !versionId.value) return;
        errorMsg.value = '';
        isLoading.value = true;

        try {
            const { data } = await api.get(`/projects/${projectId.value}/v/${versionId.value}`);
            code.value = data.code;
            language.value = enumToMonaco(data.language);
            createdAt.value = data.createdAt;
            updatedAt.value = data.updatedAt;
        } catch (error: any) {
            const msg = error?.response?.data?.error || "Failed to load file";
            errorMsg.value = msg;
            $q.notify({
                type: 'negative',
                message: msg
            });
        } finally {
            isLoading.value = false;
        }
    }

    async function save(newContent?: string) {
        if (!projectId.value) return;
        errorMsg.value = '';
        isLoading.value = true;
        const payload = { code: newContent ?? code.value };

        try {
            const { data } = await api.post(`/projects/${projectId.value}/v`, payload);
            code.value = data.code;
            language.value = enumToMonaco(data.language);
            updatedAt.value = data.updatedAt;
            createdAt.value = data.createdAt;

            router.push(`/projects/${projectId.value}/v/${data.id}`);
            $q.notify({
                type: 'positive',
                message: 'Version saved successfully'
            });
            return data;
        } catch (error: any) {
            const msg = error?.response?.data?.error || "Failed to save file";
            errorMsg.value = msg;
            $q.notify({
                type: 'negative',
                message: msg
            });
        } finally {
            isLoading.value = false;
        }
    }

    return { code, language, createdAt, updatedAt, isLoading, errorMsg, refresh, save }
}
