<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class OmniCraftDatabaseApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_requested_database_driver_is_active(): void
    {
        $this->assertSame(env('OMNICRAFT_EXPECTED_DB_DRIVER'), DB::connection()->getDriverName());
    }

    public function test_users_api_reads_writes_validates_and_deletes_records(): void
    {
        $email = 'database-' . bin2hex(random_bytes(6)) . '@example.test';

        $this->getJson('/api/users')->assertOk()->assertExactJson([]);

        $this->postJson('/api/users', [
            'name' => 'Database Integration User',
            'email' => $email,
        ])->assertCreated()->assertJsonPath('email', $email);

        $this->assertDatabaseHas('users', ['email' => $email]);
        $this->getJson('/api/users')->assertOk()->assertJsonFragment(['email' => $email]);

        $this->postJson('/api/users', [
            'name' => 'Duplicate User',
            'email' => $email,
        ])->assertUnprocessable();

        $user = \App\Models\User::query()->where('email', $email)->firstOrFail();
        $this->deleteJson('/api/users/' . $user->id)->assertOk()->assertJsonPath('email', $email);
        $this->assertDatabaseMissing('users', ['email' => $email]);
        $this->deleteJson('/api/users/' . $user->id)->assertNotFound();
    }
}
