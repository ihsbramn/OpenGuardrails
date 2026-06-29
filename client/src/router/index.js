import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    component: () => import('../views/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('../views/DashboardView.vue'),
      },
      {
        path: 'endpoints',
        name: 'Endpoints',
        component: () => import('../views/EndpointsView.vue'),
      },
      {
        path: 'validators',
        name: 'Validators',
        component: () => import('../views/ValidatorsView.vue'),
      },
      {
        path: 'guards',
        name: 'Guards',
        component: () => import('../views/GuardsView.vue'),
      },
      {
        path: 'guards/:id',
        name: 'GuardDetail',
        component: () => import('../views/GuardDetailView.vue'),
      },
      {
        path: 'logs',
        name: 'Logs',
        component: () => import('../views/LogsView.vue'),
      },
      {
        path: 'server',
        name: 'ServerConfig',
        component: () => import('../views/ServerConfigView.vue'),
      },
      {
        path: 'api-keys',
        name: 'ApiKeys',
        component: () => import('../views/ApiKeysView.vue'),
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('../views/UsersView.vue'),
        meta: { requiresAdmin: true },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return next('/login');
  }
  if (to.meta.guest && auth.isAuthenticated) {
    return next('/');
  }
  if (to.meta.requiresAdmin && auth.user?.role !== 'admin') {
    return next('/');
  }
  next();
});

export default router;
