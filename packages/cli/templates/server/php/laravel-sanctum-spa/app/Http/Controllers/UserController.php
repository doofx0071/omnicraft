<?php

namespace App\Http\Controllers;

use App\Models\ApiUser;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): Collection
    {
        return $request->user()->apiUsers()->orderBy('id')->get();
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

        return response()->json($user, 201);
    }

    public function destroy(Request $request, ApiUser $user): JsonResponse
    {
        $ownedUser = $request->user()->apiUsers()->findOrFail($user->getKey());
        $ownedUser->delete();

        return response()->json($ownedUser);
    }
}
