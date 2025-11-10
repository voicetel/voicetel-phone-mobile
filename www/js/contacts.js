// ========================================
// CONTACTS MODULE
// ========================================

window.loadContacts = async function() {
				try {
					// Check if Capacitor and Contacts plugin are available
					if (
						!window.Capacitor ||
						!window.Capacitor.Plugins ||
						!window.Capacitor.Plugins.Contacts
					) {
						window.log(
							"Contacts plugin not available - make sure you're running on a device",
						);
						alert(
							"Contacts plugin is not available. Please make sure you're running the app on a mobile device.",
						);
						return;
					}

					const Contacts = window.Capacitor.Plugins.Contacts;
					window.log("Requesting contacts permission...");
					const permission = await Contacts.requestPermissions();

					if (permission.contacts === "granted") {
						window.log("Loading contacts...");
						const result = await Contacts.getContacts({
							projection: {
								name: true,
								phones: true,
								emails: true,
								image: true,
							},
						});

						window.contactsList = result.contacts || [];
						window.log(`Loaded ${contactsList.length} contacts`);

						// Debug: Log the first contact to see the structure
						if (contactsList.length > 0) {

							window.log(
								"First contact: " +
									JSON.stringify(window.contactsList[0]),
							);
						}

						window.renderContacts();
					} else {
						window.log("Contacts permission denied");
						alert(
							"Contacts permission is required to load your contacts.",
						);
					}
				} catch (error) {
					window.log(`Error loading contacts: ${error.message}`);
					console.error("Contacts error:", error);
				}
			}

window.renderContacts = function() {
				const el = document.getElementById("contactsList");
				if (!el) return;

				if (contactsList.length === 0) {
					el.innerHTML = `
						<div class="contact-item" style="text-align: center; padding: 20px; color: #666;">
							<button class="btn-primary" onclick="window.loadContacts()">
								📱 Load Contacts
							</button>
							<p style="margin-top: 10px; font-size: 14px;">
								Tap to load your device contacts
							</p>
						</div>
					`;
					return;
				}

				// Filter contacts that have phone numbers and clean/unique them
				const contactsWithPhones = contactsList.filter((contact) => {
					const phones = contact.phones || [];
					return (
						phones.length > 0 &&
						phones.some((phone) => {
							const phoneNumber =
								typeof phone === "string"
									? phone
									: phone.number;
							return phoneNumber && phoneNumber.trim().length > 0;
						})
					);
				});

				// Sort contacts alphabetically by name
				contactsWithPhones.sort((a, b) => {
					const nameA = extractContactName(a);
					const nameB = extractContactName(b);
					return nameA
						.toLowerCase()
						.localeCompare(nameB.toLowerCase());
				});

				if (contactsWithPhones.length === 0) {
					el.innerHTML = `
						<div class="contact-item" style="text-align: center; padding: 20px; color: #666;">
							<p>No contacts with phone numbers found</p>
						</div>
					`;
					return;
				}

				el.innerHTML = "";
				contactsWithPhones.forEach((contact, index) => {
					// Extract contact name using helper function
					const name = extractContactName(contact);

					// Create a safe display name (escape quotes)
					const safeName =
						typeof name === "string"
							? name.replace(/'/g, "\\'").replace(/"/g, '\\"')
							: "Unknown";

					const phones = contact.phones || [];
					let phoneLines = "";
					const uniquePhones = new Set(); // Track unique phone numbers

					phones.forEach((phone, index) => {
						let phoneNumber = "";
						let phoneType = "Phone";

						if (typeof phone === "string") {
							phoneNumber = phone;
							phoneType = "Phone";
						} else if (phone.number) {
							phoneNumber = phone.number;
							phoneType = phone.type || "Phone";
						}

						if (phoneNumber) {
							// Clean the phone number (remove all non-digits)
							const cleanNumber = phoneNumber.replace(/\D/g, "");

							// Only add if we haven't seen this number before and it's not empty
							if (
								cleanNumber.length > 0 &&
								!uniquePhones.has(cleanNumber)
							) {
								uniquePhones.add(cleanNumber);

								// Format the display number using helper function
								const displayNumber =
									window.formatPhoneNumber(cleanNumber);

								const safePhone = cleanNumber
									.replace(/'/g, "\\'")
									.replace(/"/g, '\\"');
								phoneLines += `
									<div style="display: flex; align-items: center; justify-content: flex-start; gap: 8px; margin: 2px 0; padding: 3px 0;">
										<button onclick="callContact('${safePhone}', '${safeName}')"
											style="background: none; border: none; color: #007bff; text-decoration: underline; cursor: pointer; font-family: monospace; font-size: 12px; padding: 0; text-align: left;">
											${displayNumber}
										</button>
										<span style="font-size: 10px; color: #888; text-transform: capitalize; min-width: 50px; text-align: left;">
											${phoneType.toLowerCase()}
										</span>
									</div>
								`;
							}
						}
					});

					const contactDiv = document.createElement("div");
					contactDiv.className = "contact-item";
					contactDiv.style.cssText = `
						padding: 16px 20px;
						border-bottom: 1px solid #f0f0f0;
						cursor: pointer;
						transition: all 0.2s ease;
						background: white;
					`;

					// Create the contact display HTML with multiple phone numbers
					const contactHTML = `
						<div style="padding: 6px 0;">
							<div style="font-weight: 600; font-size: 14px; color: #333; margin-bottom: 6px;">
								${safeName}
							</div>
							${phoneLines}
						</div>
					`;

					contactDiv.innerHTML = contactHTML;

					contactDiv.addEventListener("mouseenter", () => {
						contactDiv.style.backgroundColor = "#f5f5f5";
					});
					contactDiv.addEventListener("mouseleave", () => {
						contactDiv.style.backgroundColor = "transparent";
					});

					el.appendChild(contactDiv);
				});
			}

window.callContact = function(phoneNumber, contactName) {
				// Clean the phone number
				const cleanNumber = phoneNumber.replace(/\D/g, "");
				document.getElementById("callNumber").value = cleanNumber;
				window.__originalCallNumber = cleanNumber; // Store original number for call history
				window.setView("phone");

				if (window.isRegistered) {
					window.makeCall();
				} else {
					window.log("Please register first before making calls");
				}
			}

window.clearContacts = function() {
				window.contactsList = [];
				window.renderContacts();
				window.log("Contacts cleared");
			}

window.setupContactSearch = function() {
				const searchInput = document.getElementById("contactSearch");
				if (searchInput) {
					searchInput.addEventListener("input", (e) => {
						const query = e.target.value.toLowerCase();
						if (query === "") {
							window.renderContacts();
							return;
						}

						const filteredContacts = contactsList.filter(
							(contact) => {
								// Extract contact name using helper function
								const name = extractContactName(contact);

								const nameMatch = name
									.toLowerCase()
									.includes(query);
								const phones = contact.phones || [];
								const phoneMatch = phones.some((phone) => {
									const phoneNumber =
										typeof phone === "string"
											? phone
											: phone.number;
									return (
										phoneNumber &&
										phoneNumber
											.toLowerCase()
											.includes(query)
									);
								});
								return nameMatch || phoneMatch;
							},
						);

						// Temporarily replace contactsList for rendering
						const originalContacts = contactsList;
						window.contactsList = filteredContacts;
						window.renderContacts();
						window.contactsList = originalContacts;
					});
				}
			}

