<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Baseline per-IP API rate limit — a dev/CRUD baseline, not a hard
        // guard. Tune RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MINUTES in
        // server/.env. On exceed the middleware answers 429 with the shared
        // OmniCraft JSON body and the framework's numeric Retry-After header.
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinutes((int) config('rate-limit.window_minutes'), (int) config('rate-limit.max'))
                ->by($request->ip())
                ->response(function (Request $request, array $headers) {
                    return response()->json(['error' => 'Too many requests'], 429, $headers);
                });
        });
    }
}
