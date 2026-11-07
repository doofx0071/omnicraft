<?php

use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::controller(UserController::class)->group(function () {
    Route::get('/users', 'index');
    Route::post('/users', 'store');
    Route::delete('/users/{user}', 'destroy');
});

/**
 * Unmatched /api routes answer with the shared OmniCraft JSON 404 contract:
 * HTTP 404, application/json, {error: "Not found"}.
 *
 * Laravel's Route::fallback() is deliberately not used: in Laravel 12 it
 * registers GET/HEAD only, and its compiled /api/{fallbackPlaceholder} regex
 * requires a segment after the /api prefix, so a bare request to /api would
 * keep Laravel's default (non-contract) 404 rendering. This explicit
 * catch-all is auto-prefixed to /api, runs under the same api middleware
 * group, and matches every verb for both /api and /api/* — but only after
 * the routes above have had their chance, so known resources (for example a
 * failed route-model binding) keep Laravel's exception-driven 404 body, and
 * requests outside /api (web routes, /up) are untouched.
 */
Route::any('/{any?}', fn () => response()->json(['error' => 'Not found'], 404))
    ->where('any', '.*');
