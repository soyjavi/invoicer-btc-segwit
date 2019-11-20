import dotenv from 'dotenv';
import Storage from 'vanilla-storage';

import {
  C, ERROR, formatDate, formatPrice, rateSatoshis,
} from '../common';
import render from '../common/render';
import { normalizeHtml } from './modules';

dotenv.config();
const { ICON, SECRET: secret, TITLE } = process.env;
const { STATE } = C;

export default async ({ session: { username } = {}, props: { domain, id } = {} }, res) => {
  const user = new Storage({ filename: domain, secret });
  const profile = user.get('profile').value;
  const invoice = user.get('invoices').findOne({ id });

  if (!invoice) return ERROR.NOT_FOUND(res);

  const {
    address, currency, due, from = {}, issued, items = [], total, to = {}, state,
  } = invoice;
  let { satoshis } = invoice;
  const isOwner = username === domain;
  const isConfirmed = state === STATE.CONFIRMED;
  let options = '<button class="fixed" disabled>Print</button>';
  if (isOwner) {
    options = isConfirmed
      ? '<a href="/" class="button fixed">Dashboard</a>'
      : `<a href="/invoice/${id}" class="button fixed">Edit Invoice</a>`;
  }

  // Each time customer watch the invoice we should calculate the satoshis
  if (!isOwner && items.length > 0) {
    satoshis = await rateSatoshis(total, currency);
    user.update({ id }, { ...invoice, satoshis });
  }

  const totalBTC = satoshis / 100000000;

  return res.send(
    render('index', {
      page: 'invoice-preview',
      title: `${TITLE} - Invoice`,
      scripts: !isConfirmed ? ['payment'] : [],
      content: render('invoice.preview', {
        ...profile,
        ...invoice,

        id,
        domain,

        options,

        logo: 'https://via.placeholder.com/128' || ICON,
        issued: formatDate(issued),
        due,

        from: {
          name: from.name || profile.name,
          location: (from.location || profile.location || []).join('<br>'),
          email: from.email || profile.email,
          phone: from.phone || profile.phone,
        },

        to: { ...to, location: (to.location || []).join('<br>') },

        items: normalizeHtml(items
          .map(({ price, quantity, ...item }) => render('templates/item', {
            ...item,
            quantity,
            price: formatPrice(price, currency),
            total: formatPrice(price * quantity, currency),
          }))),

        total: formatPrice(total, currency),

        info: isConfirmed
          ? render('templates/invoiceTransaction', {
            ...invoice, total: formatPrice(total, currency), totalBTC,
          })
          : render('templates/invoicePayment', {
            id, domain, address, total: formatPrice(total, currency), totalBTC,
          }),
      }),
    }),
  );
};
