<?php

namespace Tests\Feature;

use Tests\TestCase;

class OmniCraftInertiaReactNoneAuthTest extends TestCase
{
    public function test_home_page_is_public_without_authentication_routes(): void
    {
        $this->get('/')->assertOk();
        $this->get('/login')->assertNotFound();
        $this->get('/register')->assertNotFound();
        $this->get('/dashboard')->assertNotFound();
    }
}
