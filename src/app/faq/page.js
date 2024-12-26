"use client";

import PageTitle from '@/components/PageTitle';

export default function Faq() {

  return (
    <div className="container">
      <PageTitle title="FAQ" />
      <div className="accordion" id="accordionExample">
        <div className="accordion-item">
          <h2 className="accordion-header">
            <button className="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne" aria-expanded="true" aria-controls="collapseOne">
              How do I upload files to your site?
            </button>
          </h2>
          <div id="collapseOne" className="accordion-collapse collapse show" data-bs-parent="#accordionExample">
            <div className="accordion-body">
              To upload files, simply click on the "Upload" button and select the files you wish to upload. Our site will then use Jackal Network's API to store your files in a decentralized manner.
            </div>
          </div>
        </div>
        <div className="accordion-item">
          <h2 className="accordion-header">
            <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">
              How do I access my files?
            </button>
          </h2>
          <div id="collapseTwo" className="accordion-collapse collapse" data-bs-parent="#accordionExample">
            <div className="accordion-body">
              You can access your files at any time by logging into your account and navigating to the "My Files" section.
            </div>
          </div>
        </div>
        <div className="accordion-item">
          <h2 className="accordion-header">
            <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">
              How secure is my data?
            </button>
          </h2>
          <div id="collapseThree" className="accordion-collapse collapse" data-bs-parent="#accordionExample">
            <div className="accordion-body">
            Your data is stored in a decentralized manner using Jackal Network's API, which ensures that it is protected from centralized points of failure and censorship.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
