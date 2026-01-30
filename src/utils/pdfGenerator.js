const PDFDocument = require('pdfkit');

// Generate PDF for service order
const generateServiceOrderPDF = async (serviceOrder) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    
    // Add content to PDF
    doc.fontSize(18).text('Service Order', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Object: ${serviceOrder.objet}`);
    doc.text(`Market Number: ${serviceOrder.marketNumber || 'N/A'}`);
    doc.text(`BC Number: ${serviceOrder.bcNumber || 'N/A'}`);
    doc.text(`Start Date: ${serviceOrder.startDate.toLocaleDateString()}`);
    doc.text(`Client Representative: ${serviceOrder.clientRep}`);
    doc.text(`Supplier: ${serviceOrder.supplier}`);
    doc.text(`Status: ${serviceOrder.status}`);
    
    doc.end();
  });
};

// Generate PDF for price offer
const generatePriceOfferPDF = async (priceOffer) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    
    // Add content to PDF
    doc.fontSize(18).text('Price Offer', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Destinataire: ${priceOffer.destinataire}`);
    doc.text(`Demandeur: ${priceOffer.demandeur}`);
    doc.text(`Item: ${priceOffer.itemDesignation}`);
    doc.text(`Quantity: ${priceOffer.quantity} ${priceOffer.unit}`);
    doc.text(`Status: ${priceOffer.status}`);
    
    doc.end();
  });
};

module.exports = {
  generateServiceOrderPDF,
  generatePriceOfferPDF
}; 