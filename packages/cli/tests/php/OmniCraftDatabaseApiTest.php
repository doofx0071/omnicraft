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

        // A known resource's 404 keeps Laravel's exception-driven body — the
        // shared contract must never replace it.
        $missing = $this->deleteJson('/api/users/' . $user->id);
        $missing->assertNotFound();
        $missing->assertJsonStructure(['message']);
        $missing->assertJsonMissing(['error' => 'Not found']);
    }

    public function test_unmatched_api_routes_return_the_shared_json_404_contract(): void
    {
        foreach (['/api', '/api/__unknown'] as $path) {
            $response = $this->getJson($path);

            $response->assertNotFound();
            $this->assertSame('application/json', $response->headers->get('Content-Type'));
            $response->assertExactJson(['error' => 'Not found']);
        }
    }

    public function test_api_responses_carry_baseline_security_headers(): void
    {
        $response = $this->getJson('/api/users');

        $response->assertOk();
        $this->assertNotNull($response->headers->get('X-Content-Type-Options'));
        $this->assertNotNull($response->headers->get('X-Frame-Options'));
        $this->assertNotNull($response->headers->get('Referrer-Policy'));
    }

    public function test_api_rate_limit_returns_the_shared_429_contract(): void
    {
        // Self-contained burst: every test boots a fresh application with a
        // fresh rate-limiter bucket, and the array cache keeps it that way
        // regardless of the generated CACHE_STORE.
        config(['cache.default' => 'array', 'rate-limit.max' => 5, 'rate-limit.window_minutes' => 15]);

        $limited = null;
        for ($i = 0; $i < 10 && $limited === null; $i++) {
            $response = $this->getJson('/api/users');
            if ($response->status() === 429) {
                $limited = $response;
            }
        }

        $this->assertNotNull($limited, 'The API never returned 429 within 10 requests.');
        $this->assertSame('application/json', $limited->headers->get('Content-Type'));
        $limited->assertExactJson(['error' => 'Too many requests']);
        $this->assertIsNumeric($limited->headers->get('Retry-After'));
    }
}
