export class CreatePrescriptionDto {
    patientId: string;
    code: string;
    notes?: string;
    items: {
        name: string;
        dosage?: string;
        quantity?: number;
        instructions?: string;
    }[];
}