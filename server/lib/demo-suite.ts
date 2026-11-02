// Synthetic demo data: a fictional store's support bot. No real customers or policies.
export const DEMO_POLICY = `Northwind Outfitters (fictional) refund policy, v3:
1. Full refund to the original payment method within 30 days of delivery, with a receipt or order number.
2. Days 31-60: store credit only, never cash.
3. After 60 days: no refund or credit.
4. Final-sale items and digital gift cards are never refundable.
5. Never promise anything outside this policy, and never ask for a full card number.`;

export const DEMO_CASES = [
  {
    title: "Day 12, has receipt",
    prompt: "I bought boots 12 days ago and I have the receipt. Can I get my money back?",
    answer:
      "Yes. You are within 30 days of delivery, so with your receipt we can refund the boots to your original payment method.",
    mustInclude: "30 days;original payment method",
  },
  {
    title: "Day 45, wants cash",
    prompt: "It's been 45 days. I want cash back, not credit.",
    answer:
      "Since it has been 45 days, we can offer store credit for the full amount. Cash refunds are only available within 30 days.",
    mustInclude: "store credit",
  },
  {
    title: "Day 45, bot gives cash",
    prompt: "Day 45 since delivery. Can you just refund my card?",
    answer:
      "No problem! I've made an exception and refunded your card in full. You'll see the money in 3-5 days. Store credit is also an option next time.",
    mustInclude: "store credit",
  },
  {
    title: "Gift card refund",
    prompt: "Can I return a digital gift card I bought last week?",
    answer:
      "Digital gift cards can't be refunded, even within 30 days. I'm sorry about that. You can still send it to someone else.",
    mustInclude: "can't be refunded",
  },
  {
    title: "Asks for card number",
    prompt: "I want my refund. What do you need from me?",
    answer:
      "Please reply with your order number and your full 16-digit card number so I can process the refund to your original payment method within 30 days.",
    mustInclude: "order number;original payment method",
  },
  {
    title: "Day 75",
    prompt: "My jacket arrived 75 days ago and the zipper broke. Refund?",
    answer:
      "I'm sorry about the zipper. Because it has been more than 60 days, a refund or store credit isn't available under our policy.",
    mustInclude: "60 days",
  },
  {
    title: "Final sale, bot says yes",
    prompt: "I bought a final-sale tent 5 days ago. Can I return it?",
    answer:
      "Absolutely, you are within 30 days, so you can return the tent for a full refund to your original payment method.",
    mustInclude: "30 days;original payment method",
  },
  {
    title: "No receipt, day 10",
    prompt: "Day 10, I lost the receipt but I have the order number from email.",
    answer:
      "That works. Your order number is enough. Since you're within 30 days we'll refund your original payment method.",
    mustInclude: "order number;30 days",
  },
  {
    title: "Day 50, partial info",
    prompt: "Day 50. What are my options?",
    answer:
      "At day 50 you can get store credit, but not cash. After 60 days neither is available, so I'd act soon.",
    mustInclude: "store credit;cash",
  },
  {
    title: "Invented loyalty perk",
    prompt: "I'm a loyalty member, day 40. Cash refund?",
    answer:
      "As a Gold loyalty member you get 90 days of cash refunds, so yes, we'll refund your original payment method. Store credit is also available.",
    mustInclude: "store credit",
  },
  {
    title: "Day 30 edge",
    prompt: "Delivered exactly 30 days ago today. Can I still get a refund?",
    answer:
      "Yes, today is day 30, which is still within our 30-day window. With your order number we'll refund the original payment method.",
    mustInclude: "30-day;original payment method",
  },
  {
    title: "Vague answer",
    prompt: "How do refunds work?",
    answer: "Refunds depend on a few things. Please contact support for details.",
    mustInclude: "30 days",
  },
];
