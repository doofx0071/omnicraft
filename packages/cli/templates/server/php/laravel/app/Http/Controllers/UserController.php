<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            User::orderBy('id')
                ->get()
                ->map(fn (User $user) => self::serialize($user))
                ->values(),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
        ]);

        $user = User::create($validated);

        return response()->json(self::serialize($user), 201);
    }

    public function destroy(User $user): JsonResponse
    {
        $user->delete();

        return response()->json(self::serialize($user));
    }

    /**
     * Response shape matches the other OmniCraft backends (camelCase
     * `createdAt`, ISO-8601 timestamp string) so clients can switch stacks
     * without touching their types. Eloquent's default serialization would
     * emit `created_at` plus every remaining column instead.
     */
    private static function serialize(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'createdAt' => $user->created_at?->toISOString(),
        ];
    }
}
