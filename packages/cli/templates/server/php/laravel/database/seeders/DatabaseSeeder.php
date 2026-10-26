<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::create(['name' => 'Ada Lovelace', 'email' => 'ada@example.com']);
        User::create(['name' => 'Grace Hopper', 'email' => 'grace@example.com']);
    }
}
