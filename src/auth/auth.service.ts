import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(data: any) {
  const hashedPassword = await bcrypt.hash(data.password, 10);

  // Aseguramos que el rol venga en el formato correcto (minúsculas según tu enum)
  const userRole = data.role; 

  const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: userRole,
        
        // Si el rol es doctor, crea automáticamente la fila en la tabla Doctor
        doctor: userRole === 'doctor' ? {
          create: {
            specialty: data.specialty || null, // Guarda la especialidad si viene en el formulario
          },
        } : undefined,

        // Si el rol es patient, crea automáticamente la fila en la tabla Patient
        patient: userRole === 'patient' ? {
          create: {
            birthDate: data.birthDate ? new Date(data.birthDate) : null, // Mapea la fecha correctamente si viene
          },
        } : undefined,
      },
      // Opcional: incluye las tablas en el retorno si necesitas usar esos datos de inmediato
      include: {
        doctor: true,
        patient: true,
      },
    });

    return user;
  }


  async login(data: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const passwordMatch = await bcrypt.compare(
      data.password,
      user.password,
    );

    if (!passwordMatch) {
      throw new Error('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}