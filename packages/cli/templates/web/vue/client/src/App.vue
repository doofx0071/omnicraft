<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "./lib/api";
import type { User } from "./lib/api";

const users = ref<User[]>([]);
const name = ref("");
const email = ref("");
const error = ref<string | null>(null);
const loading = ref(true);

async function loadUsers() {
  loading.value = true;
  try {
    users.value = await api.listUsers();
    error.value = null;
  } catch {
    error.value =
      "Could not reach the API. In a full-stack project run `docker compose up -d` and `npm run db:push`, then start the server with `npm run dev`.";
  } finally {
    loading.value = false;
  }
}

async function addUser() {
  try {
    await api.createUser({ name: name.value, email: email.value });
    name.value = "";
    email.value = "";
    await loadUsers();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Something went wrong";
  }
}

async function removeUser(id: number) {
  try {
    await api.deleteUser(id);
    await loadUsers();
  } catch {
    error.value = "Could not delete the user.";
  }
}

onMounted(() => {
  void loadUsers();
});
</script>

<template>
  <main class="app">
    <h1>⚡ OmniCraft App</h1>
    <p class="subtitle">Scaffolded by OmniCraft — this page talks to the users API end-to-end.</p>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <form class="form" @submit.prevent="addUser">
      <input v-model="name" class="input" placeholder="Name" required />
      <input v-model="email" class="input" type="email" placeholder="Email" required />
      <button class="btn" type="submit" :disabled="!name || !email">Add user</button>
    </form>

    <p v-if="loading" class="muted">Loading users…</p>
    <ul v-else class="user-list">
      <li v-for="user in users" :key="user.id" class="user-row">
        <span>
          <strong>{{ user.name }}</strong>
          <span class="muted">{{ user.email }}</span>
        </span>
        <button class="btn btn-ghost" type="button" @click="removeUser(user.id)">Delete</button>
      </li>
      <li v-if="users.length === 0" class="muted">
        No users yet — add one above (it is stored in the database).
      </li>
    </ul>
  </main>
</template>
