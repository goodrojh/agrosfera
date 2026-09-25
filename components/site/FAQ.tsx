"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { asset } from "@/lib/config";
import { LIMITS } from "@/lib/market/validate";

const faqs = [
  {
    question: "Откуда берутся цены?",
    answer:
      "Их присылают сами производители. Каждое утро сотрудник предприятия отправляет в наш бот (Telegram или MAX) цену за тонну и свободный объём. Предприятие попадает в систему только по нашему приглашению — случайные люди цены не подают.",
  },
  {
    question: "Что если предприятие ошибётся в цифре?",
    answer: `Бот повторяет, что понял, и переспрашивает. «30» вместо «30 000» — предложит исправить одной кнопкой. Лишний ноль — тоже. Цена, которая отличается от медианы региона больше чем на ${Math.round(LIMITS.soft * 100)}%, требует подтверждения, больше чем на ${Math.round(LIMITS.hard * 100)}% — уходит модератору и не участвует в индексе до проверки. А сам индекс — медиана, поэтому одиночный выброс его не сдвигает.`,
  },
  {
    question: "Как обновить цену в течение дня?",
    answer:
      "Просто отправить боту новое сообщение. Новая цена сразу заменит прежнюю в расчёте, график обновится в реальном времени. Прежние значения сохраняются в истории.",
  },
  {
    question: "Видно ли, какое предприятие дало цену?",
    answer:
      "Нет. Наружу показываем регион, цену и объём под кодом вида «П-0412». Контакты производителя передаются только в рамках сделки через нас.",
  },
  {
    question: "Какая цена указана в котировке?",
    answer:
      "Рубли за тонну масличного льна с НДС на условиях EXW — со склада предприятия. Доставку до порта или погранперехода считаем отдельно под конкретную заявку.",
  },
  {
    question: "Зачем разбивка по направлениям?",
    answer:
      "Логистика часто важнее разницы в цене. Для Китая выгоднее брать Сибирь и Дальний Восток — плечо до Забайкальска и Благовещенска короче. Для Чёрного моря — Юг и Нижнее Поволжье. Фильтр направления показывает только подходящие регионы.",
  },
  {
    question: "Сколько это стоит?",
    answer:
      "Смотреть котировки и подавать цены — бесплатно. С экспортёром работаем как агент: выкупаем и доставляем партию, цена — в коммерческом предложении. С агентами заключаем договор и получаем процент от сделки.",
  },
];

export default function FAQ({ className }: { className?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className={"w-full bg-white py-20 px-4 md:px-6 font-sans scroll-mt-10 " + (className || "")}>
      <div className="max-w-[640px] mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-[#111010] font-sans text-[34px] md:text-[48px] font-semibold leading-[1.1] tracking-tight mb-5 text-center">
            Частые <br /> вопросы
          </h2>
          <p className="text-[#7d8778] text-[16px] leading-[1.6] text-center max-w-[450px] mx-auto">
            Коротко о том, откуда цифры и как с ними работать.
          </p>
        </div>

        <div className="relative max-w-[600px] mx-auto group">
          <div className="absolute -inset-3 md:-inset-8 bg-gray-100 rounded-[32px] md:rounded-[40px] overflow-hidden z-0 shadow-inner">
            <img
              src={asset("/media/macro.jpg")}
              alt=""
              className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
          </div>

          <div className="relative z-10 bg-white/55 backdrop-blur-2xl rounded-[24px] md:rounded-[32px] border border-white/50 overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div
                  key={index}
                  className={"relative bg-transparent transition-colors duration-150 border-b border-white/40 last:border-b-0 " + (!isOpen ? "hover:bg-white/25" : "")}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="w-full text-left px-5 py-5 md:px-7 md:py-6 flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                  >
                    <span className="text-[#111010] text-[16px] font-semibold tracking-tight">{faq.question}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] as const }}
                      className="text-[#111010]/60 flex items-center justify-center shrink-0"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key={"faq-answer-" + index}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] as const }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 md:px-7 pb-6 md:pb-7 pt-0">
                          <p className="text-[#333833] text-[15px] leading-[1.7] font-medium">{faq.answer}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
