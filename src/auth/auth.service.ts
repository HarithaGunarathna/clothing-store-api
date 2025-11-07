import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'node_modules/bcryptjs';
import { User } from 'src/user/model/user.entity';
import { NewUserDTO } from 'src/user/dto/createUserDTO';

@Injectable()
export class AuthService {
    constructor(private readonly userService: UserService, private jwtService: JwtService) {}

    async signIn(userName: string, password: string): Promise<{ access_token: string }> {

        const user: User | null = await this.userService.findUserByUsername(userName);

        if (!user) {
            throw new UnauthorizedException("User Does Not Exist");
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            throw new UnauthorizedException("Incorrect Username or Password");
        }
        const payload = { userId: user.id, username: user.userName };
        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }

    async registerUser(userData: NewUserDTO): Promise<{ access_token: string }> {
        const existingUser = await this.userService.findUserByUsername(userData.userName);
        if (existingUser) {
            throw new UnauthorizedException("User Already Exists");
        }
        const newUser = await this.userService.createUser(userData);

        const payload = { userId: newUser.id, username: newUser.userName };
        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }

    async getAllUsers(): Promise<User[]> {
        return this.userService.getAllUsers();
    }
}

