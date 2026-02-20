import { ref } from 'vue';
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

export function useVersion(projectId: number, versionId: number) {
    const router = useRouter();
    const $q = useQuasar();

    const code = ref('');
    const language = ref('plaintext');
    const createdAt = ref<string | null>(null);
    const updatedAt = ref<string | null>(null);
    const isLoading = ref(false);
    const errorMsg = ref(''); // Keeping for fallback or specific UI placement if needed, but primarily using Notify

    async function refresh() {
        errorMsg.value = '';
        isLoading.value = true;

        try {
            const { data } = await api.get(`/projects/${projectId}/v/${versionId}`);
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
        errorMsg.value = '';
        isLoading.value = true;
        const payload = { code: newContent ?? code.value };

        try {
            const { data } = await api.post(`/projects/${projectId}/v`, payload);
            code.value = data.code;
            language.value = enumToMonaco(data.language);
            updatedAt.value = data.updatedAt;
            createdAt.value = data.createdAt;

            router.push(`/projects/${projectId}/v/${data.id}`);
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
