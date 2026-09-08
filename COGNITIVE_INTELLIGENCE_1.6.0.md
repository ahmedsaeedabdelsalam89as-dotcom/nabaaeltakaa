# Naba Cognitive Intelligence 1.6.0

طبقة رفع الذكاء الجديدة مبنية فوق NabaFleetAI الحالي بدون إنشاء محرك موازٍ.

- Cognitive Memory: Working / Episodic / Semantic / Lessons، استرجاع موجه، توحيد محافظ، ولا تتحول الخبرة إلى قاعدة نافذة دون مراجعة بشرية.
- Evidence Graph: كل ادعاء يحمل المصدر، معرف المصدر، الكيانات، Fact/Inference/Prediction/Unknown، ودرجة ثقة قابلة للتدقيق.
- World Model: Snapshot للمركبة ومحاكاة سيناريوهات تشغيلية محافظة مع assumptions/limitations وHuman Approval Guard.
- Outcome Ledger يغذي Lessons، والأوامر تسجل Working/Episodic memory.
- الاختبار القابل للإعادة: `npm run test:cognitive`.
- فحص الإصدار/سلامة data-bundle: `npm run preflight`.
