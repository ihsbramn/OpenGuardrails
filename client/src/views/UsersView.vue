<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Users</h2>
        <div class="page-subtitle">Manage users and role-based access control</div>
      </div>
      <button class="btn btn-primary" @click="showCreate = true">+ Add User</button>
    </div>

    <div class="page-body">
      <div v-if="loading" class="empty-state"><p>Loading...</p></div>

      <table class="data-table" v-if="!loading && users.length">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Login</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td><strong>{{ u.full_name }}</strong></td>
            <td>{{ u.email }}</td>
            <td>
              <span :class="['badge', u.role === 'admin' ? 'badge-warning' : 'badge-info']">
                {{ u.role }}
              </span>
            </td>
            <td>
              <span :class="['badge', u.is_active ? 'badge-success' : 'badge-default']">
                {{ u.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td style="font-size:12px;color:var(--color-text-dim)">{{ formatDate(u.last_login_at) || 'Never' }}</td>
            <td style="font-size:12px;color:var(--color-text-dim)">{{ formatDate(u.created_at) }}</td>
            <td>
              <div class="btn-group">
                <button class="btn btn-secondary btn-sm" @click="editUser(u)">Edit</button>
                <button class="btn btn-danger btn-sm" @click="deleteUser(u)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showCreate || editingUser" @click.self="closeModal">
      <div class="modal slide-up">
        <div class="modal-header">
          <h3>{{ editingUser ? 'Edit User' : 'Add New User' }}</h3>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        <form @submit.prevent="saveUser">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input v-model="form.full_name" class="form-input" placeholder="John Doe" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input v-model="form.email" type="email" class="form-input" placeholder="user@example.com" required :disabled="!!editingUser" />
          </div>
          <div class="form-group">
            <label class="form-label">Password {{ editingUser ? '(leave empty to keep current)' : '*' }}</label>
            <input v-model="form.password" type="password" class="form-input" :placeholder="editingUser ? '••••••' : 'Enter password'" :required="!editingUser" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Role</label>
              <select v-model="form.role" class="form-select">
                <option v-for="r in roles" :key="r.id" :value="r.name">{{ r.name }} — {{ r.description }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Active</label>
              <label class="toggle" style="display:block;margin-top:8px">
                <input type="checkbox" v-model="form.is_active" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save User' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../utils/api';
import { useModal } from '../utils/modals';

const { showNotification, showConfirm } = useModal();

const users = ref([]);
const roles = ref([]);
const loading = ref(true);
const saving = ref(false);
const showCreate = ref(false);
const editingUser = ref(null);

const form = ref({
  full_name: '', email: '', password: '', role: 'user', is_active: true,
});

async function load() {
  loading.value = true;
  try {
    const [usersRes, rolesRes] = await Promise.all([
      api.get('/users'),
      api.get('/users/roles'),
    ]);
    users.value = usersRes.data;
    roles.value = rolesRes.data;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.value = { full_name: '', email: '', password: '', role: 'user', is_active: true };
}

function closeModal() {
  showCreate.value = false;
  editingUser.value = null;
  resetForm();
}

function editUser(u) {
  editingUser.value = u;
  form.value = {
    full_name: u.full_name,
    email: u.email,
    password: '',
    role: u.role,
    is_active: u.is_active,
  };
}

async function saveUser() {
  saving.value = true;
  try {
    if (editingUser.value) {
      await api.put(`/users/${editingUser.value.id}`, form.value);
    } else {
      await api.post('/users', form.value);
    }
    closeModal();
    await load();
  } catch (err) {
    await showNotification('Save Failed', err.response?.data?.error || 'Save failed', 'error');
  } finally {
    saving.value = false;
  }
}

async function deleteUser(u) {
  const ok = await showConfirm('Delete User', `Delete user "${u.full_name}"? This action cannot be undone.`, 'Delete');
  if (!ok) return;
  try {
    await api.delete(`/users/${u.id}`);
    await load();
  } catch (err) {
    await showNotification('Delete Failed', err.response?.data?.error || 'Delete failed', 'error');
  }
}

function formatDate(d) {
  return d ? new Date(d).toLocaleString() : '';
}

onMounted(load);
</script>
