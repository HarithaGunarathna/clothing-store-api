import { Body, Controller, Post, Headers, HttpCode, Req, Get } from '@nestjs/common';
import { LoginDTO } from 'src/user/dto/loginDTO';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { NewUserDTO } from 'src/user/dto/createUserDTO';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    @HttpCode(200)
    async login(@Req() request: Request, @Body() loginDto: LoginDTO): Promise<any> {
        const response = await this.authService.signIn(loginDto.userName, loginDto.password);
        return response;
    }

    @Post('register')
    @HttpCode(201)
    async register(@Body() userData: NewUserDTO): Promise<any> {
        const response = await this.authService.registerUser(userData);
        return response;
    }

    @Get('all-users')
    @HttpCode(200)
    async getAllUsers(): Promise<any> {
        const response = await this.authService.getAllUsers();
        return response;
    }
}
