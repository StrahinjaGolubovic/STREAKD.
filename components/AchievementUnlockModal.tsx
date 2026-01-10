'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Achievement {
    id: number;
    name: string;
    description: string;
    icon: string;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    points: number;
}

interface AchievementUnlockModalProps {
    achievement: Achievement | null;
    onClose: () => void;
}

const TIER_COLORS = {
    bronze: 'from-amber-700 to-amber-900',
    silver: 'from-gray-400 to-gray-600',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-cyan-400 to-blue-500'
};

export default function AchievementUnlockModal({ achievement, onClose }: AchievementUnlockModalProps) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (achievement) {
            setShow(true);
            // Auto-close after 5 seconds
            const timer = setTimeout(() => {
                handleClose();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [achievement]);

    const handleClose = () => {
        setShow(false);
        setTimeout(onClose, 300);
    };

    if (!achievement) return null;

    return (
        <AnimatePresence>
            {show && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0, y: 50 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.5, opacity: 0, y: 50 }}
                            transition={{ type: 'spring', duration: 0.5 }}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full border-2 border-gray-700 relative overflow-hidden"
                        >
                            {/* Animated Background */}
                            <div className="absolute inset-0 opacity-10">
                                <motion.div
                                    animate={{
                                        scale: [1, 1.2, 1],
                                        rotate: [0, 180, 360],
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        ease: 'linear'
                                    }}
                                    className={`absolute inset-0 bg-gradient-to-r ${TIER_COLORS[achievement.tier]} blur-3xl`}
                                />
                            </div>

                            {/* Content */}
                            <div className="relative z-10 text-center">
                                {/* Title */}
                                <motion.div
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-yellow-400 font-bold text-sm mb-2 tracking-wider"
                                >
                                    🎉 ACHIEVEMENT UNLOCKED! 🎉
                                </motion.div>

                                {/* Icon */}
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{
                                        delay: 0.3,
                                        type: 'spring',
                                        stiffness: 200,
                                        damping: 10
                                    }}
                                    className="text-9xl mb-4"
                                >
                                    {achievement.icon}
                                </motion.div>

                                {/* Tier Badge */}
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className={`inline-block px-4 py-1 rounded-full text-xs font-bold mb-4 bg-gradient-to-r ${TIER_COLORS[achievement.tier]}`}
                                >
                                    {achievement.tier.toUpperCase()}
                                </motion.div>

                                {/* Name */}
                                <motion.h2
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="text-3xl font-bold text-white mb-2"
                                >
                                    {achievement.name}
                                </motion.h2>

                                {/* Description */}
                                <motion.p
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.6 }}
                                    className="text-gray-300 mb-6"
                                >
                                    {achievement.description}
                                </motion.p>

                                {/* Points */}
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.7, type: 'spring' }}
                                    className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/50 rounded-full px-6 py-3 mb-6"
                                >
                                    <span className="text-2xl">⭐</span>
                                    <span className="text-yellow-400 font-bold text-xl">+{achievement.points} Points</span>
                                </motion.div>

                                {/* Close Button */}
                                <motion.button
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.8 }}
                                    onClick={handleClose}
                                    className="w-full bg-gradient-to-r from-primary-500 to-cyan-500 hover:from-primary-600 hover:to-cyan-600 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105"
                                >
                                    Awesome! 🎊
                                </motion.button>

                                {/* Auto-close hint */}
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1 }}
                                    className="text-gray-500 text-xs mt-3"
                                >
                                    Auto-closes in 5 seconds
                                </motion.p>
                            </div>

                            {/* Confetti Effect */}
                            <div className="absolute inset-0 pointer-events-none">
                                {[...Array(20)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{
                                            x: '50%',
                                            y: '50%',
                                            scale: 0,
                                            opacity: 1
                                        }}
                                        animate={{
                                            x: `${Math.random() * 100}%`,
                                            y: `${Math.random() * 100}%`,
                                            scale: [0, 1, 0],
                                            opacity: [1, 1, 0]
                                        }}
                                        transition={{
                                            duration: 1.5,
                                            delay: 0.3 + Math.random() * 0.5,
                                            ease: 'easeOut'
                                        }}
                                        className="absolute w-2 h-2 rounded-full"
                                        style={{
                                            backgroundColor: ['#fbbf24', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'][i % 5]
                                        }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
