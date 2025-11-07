import { Injectable } from '@nestjs/common';
import { NewUserDTO } from 'src/user/dto/createUserDTO';
import { User } from './model/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    async createUser(newUserDTO: NewUserDTO) {
        const newUser = {
            userName: newUserDTO.userName,
            email: newUserDTO.email,
            firstName: newUserDTO.firstName,
            lastName: newUserDTO.lastName,
            phoneNumber: newUserDTO.phoneNumber || undefined,
            dob: newUserDTO.dob || undefined,
            role: newUserDTO.role,
            passwordHash: newUserDTO.password,
        };
        const user = this.userRepository.create(newUser);
        await this.userRepository.save(user);
        return user;
    }

    async findUserByUsername(userName: string) {
        return this.userRepository.findOne({ where: { userName: userName } });
    }

    async getAllUsers() {
        return this.userRepository.find();
    }
}
