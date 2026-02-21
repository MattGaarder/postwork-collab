const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/LoginPage.vue') },
    { path: '/login', component: () => import('pages/LoginPage.vue') },
    { path: '/projects', component: () => import('pages/ProjectsPage.vue') },
    { path: '/projects/:projectId', component: () => import('pages/ProjectPageSimplify.vue') },
    { path: '/projects/:projectId/v/:versionId', component: () => import('pages/ProjectPageSimplify.vue') },
    { path: '/account', component: () => import('pages/AccountPage.vue') },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
