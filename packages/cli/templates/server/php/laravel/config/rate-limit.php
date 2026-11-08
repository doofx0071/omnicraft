<?php

return [
    'max' => env('RATE_LIMIT_MAX', 300),
    'window_minutes' => env('RATE_LIMIT_WINDOW_MINUTES', 15),
];
