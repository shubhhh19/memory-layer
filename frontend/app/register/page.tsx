'use client';

import RegisterForm from '@/app/components/auth/RegisterForm';

export default function RegisterPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create account</h1>
                        <p className="text-gray-600">Get started with MemoryMesh</p>
                    </div>
                    <RegisterForm />
                </div>
            </div>
        </div>
    );
}

