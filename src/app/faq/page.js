'use client';

import PageTitle from '@/components/PageTitle';

const faqItems = [
  {
    id: 'collapseOne',
    question: 'How do I upload files to your site?',
    answer: 'Click the "Upload" button and select the files you want to upload. Our site will then use Jackal Network\'s API to store your files in a decentralized manner.',
  },
  {
    id: 'collapseTwo',
    question: 'How do I access my files?',
    answer: 'You can access your files at any time by logging into your account and navigating to the "My Files" section.',
  },
  {
    id: 'collapseThree',
    question: 'How secure is my data?',
    answer: 'Your data is stored in a decentralized way via Jackal Network’s API, which ensures that it is protected from centralized points of failure and censorship.',
  },
];

export default function Faq() {
  return (
    <div className="container">
      <PageTitle title="FAQ" />
      <div className="accordion" id="accordionExample">
        {faqItems.map((item, index) => (
          <div className="accordion-item" key={item.id}>
            <h2 className="accordion-header">
              <button
                className={`accordion-button ${index !== 0 ? 'collapsed' : ''}`}
                type="button"
                data-bs-toggle="collapse"
                data-bs-target={`#${item.id}`}
                aria-expanded={index === 0 ? 'true' : 'false'}
                aria-controls={item.id}
              >
                {item.question}
              </button>
            </h2>
            <div
              id={item.id}
              className={`accordion-collapse collapse ${index === 0 ? 'show' : ''}`}
              data-bs-parent="#accordionExample"
            >
              <div className="accordion-body">{item.answer}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
