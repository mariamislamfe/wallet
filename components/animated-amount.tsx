"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "framer-motion";

import { formatMoney, fractionDigitsFor } from "@/lib/format";

export function AnimatedAmount({ value, className }: { value: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  const spring = useSpring(value, { stiffness: 160, damping: 24, mass: 0.7 });
  const fractionDigits = useRef(fractionDigitsFor(value));
  const text = useTransform(spring, (latest) => formatMoney(latest, fractionDigits.current));

  useEffect(() => {
    fractionDigits.current = fractionDigitsFor(value);
    if (reduceMotion) spring.jump(value);
    else spring.set(value);
  }, [value, reduceMotion, spring]);

  return (
    <motion.span className={className} title={formatMoney(value)}>
      {text}
    </motion.span>
  );
}
