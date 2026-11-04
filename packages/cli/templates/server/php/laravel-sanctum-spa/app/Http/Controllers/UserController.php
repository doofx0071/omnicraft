<?php

namespace App\Http\Controllers;

use App\Models\ApiUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(
            $request->user()
                ->apiUsers()
                ->orderBy('id')
                ->get()
                ->map(fn (ApiUser $user) => self::serialize($user))
                ->values(),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('api_users', 'email')->where(
                    fn ($query) => $query->where('owner_id', $request->user()->getAuthIdentifier()),
                ),
            ],
        ]);

        $user = $request->user()->apiUsers()->create($validated);

        return response()->json(self::serialize($user), 201);
    }

    public function destroy(Request $request, ApiUser $user): JsonResponse
    {
        $ownedUser = $request->user()->apiUsers()->findOrFail($user->getKey());
        $ownedUser->delete();

        return response()->json(self::serialize($ownedUser));
    }

    /**
     * Response shape matches the other OmniCraft backends (camelCase
     * `createdAt`, ISO-8601 timestamp string) so the SPA's User type works
     * unchanged against every stack. Eloquent's default serialization would
     * emit `created_at` plus every remaining column instead.
     */
    private static function serialize(ApiUser $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'createdAt' => $user->created_at?->toISOString(),
        ];
    }
}
