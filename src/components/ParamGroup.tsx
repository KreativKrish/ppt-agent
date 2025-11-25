import React from "react";
import { cn } from "@/lib/utils";

interface ParamGroupProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

export function ParamGroup({ title, children, className }: ParamGroupProps) {
    return (
        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 shadow-sm hover:shadow-md transition-shadow duration-200">
            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider border-b border-gray-200 pb-2">{title}</h3>
            <div className="space-y-4">
                {children}
            </div>
        </div>
    );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

export function Input({ label, className, ...props }: InputProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-800">{label}</label>
            <input
                className={cn(
                    "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 shadow-sm transition-all hover:border-gray-400",
                    className
                )}
                {...props}
            />
        </div>
    );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
}

export function TextArea({ label, className, ...props }: TextAreaProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-800">{label}</label>
            <textarea
                className={cn(
                    "flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 shadow-sm transition-all hover:border-gray-400",
                    className
                )}
                {...props}
            />
        </div>
    );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-800">{label}</label>
            <select
                className={cn(
                    "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 shadow-sm transition-all hover:border-gray-400",
                    className
                )}
                {...props}
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
