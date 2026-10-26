<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from './lib/api'
  import type { User } from './lib/api'

  let users = $state<User[]>([])
  let name = $state('')
  let email = $state('')
  let error = $state<string | null>(null)
  let loading = $state(true)

  async function loadUsers() {
    loading = true
    try {
      users = await api.listUsers()
      error = null
    } catch {
      error =
        'Could not reach the API. In a full-stack project run `docker compose up -d` and `npm run db:push`, then start the server with `npm run dev`.'
    } finally {
      loading = false
    }
  }

  async function addUser(event: SubmitEvent) {
    event.preventDefault()
    try {
      await api.createUser({ name, email })
      name = ''
      email = ''
      await loadUsers()
    } catch (err) {
      error = err instanceof Error ? err.message : 'Something went wrong'
    }
  }

  async function removeUser(id: number) {
    try {
      await api.deleteUser(id)
      await loadUsers()
    } catch {
      error = 'Could not delete the user.'
    }
  }

  onMount(() => {
    void loadUsers()
  })
</script>

<main class="app">
  <h1>⚡ OmniCraft App</h1>
  <p class="subtitle">Scaffolded by OmniCraft — this page talks to the users API end-to-end.</p>

  {#if error}
    <div class="error-banner">{error}</div>
  {/if}

  <form class="form" onsubmit={addUser}>
    <input class="input" placeholder="Name" bind:value={name} required />
    <input class="input" type="email" placeholder="Email" bind:value={email} required />
    <button class="btn" type="submit" disabled={!name || !email}>Add user</button>
  </form>

  {#if loading}
    <p class="muted">Loading users…</p>
  {:else}
    <ul class="user-list">
      {#each users as user (user.id)}
        <li class="user-row">
          <span>
            <strong>{user.name}</strong>
            <span class="muted">{user.email}</span>
          </span>
          <button class="btn btn-ghost" type="button" onclick={() => removeUser(user.id)}>
            Delete
          </button>
        </li>
      {/each}
      {#if users.length === 0}
        <li class="muted">No users yet — add one above (it is stored in the database).</li>
      {/if}
    </ul>
  {/if}
</main>
