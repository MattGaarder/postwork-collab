import { defineStore } from "pinia";

export const useAuth = defineStore('auth', {
    state: () => ({ token: localStorage.getItem('jwt') as string | null, user:null as null | { id:number; email:string; name:string | null } }),
    actions: {
        setAuth(token:string, user: any){
            this.token = token;
            this.user = user;
            localStorage.setItem('jwt', token);
        },
        logout() {
            this.token = null; this.user = null;
            localStorage.removeItem('jwt');
        },
        async initialize() {
            if (!this.token) return;
            try {
                const { api } = await import("../lib/http");
                const { data } = await api.get("/auth/me");
                this.user = data;
            } catch (error) {
                console.error("Failed to initialize auth:", error);
                this.logout();
            }
        }
    }
});
