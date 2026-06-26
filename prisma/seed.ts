import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {

  const passwordHash = await bcrypt.hash('12345', 10);
  // Upsert para el Médico
  const doctorUser = await prisma.user.upsert({
    where: { email: 'doctor@test.com' },
    update: {password: passwordHash}, // No cambia nada si ya existe
    create: {
      email: 'doctor@test.com',
      password: passwordHash, 
      name: 'Dr. House',
      role: 'doctor',
      doctor: { create: { specialty: 'Diagnóstico' } }
    },
    include: { doctor: true }
  });

  // Upsert para el Paciente
  const patientUser = await prisma.user.upsert({
    where: { email: 'paciente@test.com' },
    update: {password: passwordHash}, // No cambia nada si ya existe
    create: {
      email: 'paciente@test.com',
      password: passwordHash,
      name: 'John Doe',
      role: 'patient',
      patient: { create: { birthDate: new Date('1990-01-01') } }
    },
    include: { patient: true }
  });

  console.log('--- SEED COMPLETADO ---');
  console.log('Doctor User ID:', doctorUser.id);
  console.log('Patient ID (para la receta):', patientUser.patient?.id);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());