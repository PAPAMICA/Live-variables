<div align="center">
  <img src="https://github.com/user-attachments/assets/161c80a9-a1fa-427c-9861-a06552527387" width="100%" alt="Banner">

# v2.1.0 is out!
</div>
<p align="center">
  <a href="https://github.com/HamzaBenyazid/obsidian-live-variables/releases"><img src="https://img.shields.io/github/downloads/HamzaBenyazid/obsidian-live-variables/total?color=%233DDC84&logo=github&logoColor=%23fff&style=for-the-badge" alt="Downloads"></a>
</p>

**Supercharge your notes with dynamic data!** The Live Variables Plugin v2 revolutionizes how you manage information in Obsidian. Define variables once, reuse them everywhere, and watch your notes auto-update—now with powerful code blocks, smart queries, and an intuitive form interface.

[![Sponsor this project](https://img.shields.io/badge/Sponsor-%E2%9D%A4-red?logo=github)](https://github.com/sponsors/HamzaBenyazid)  
*Love this plugin? Help keep it alive! [Sponsor development →](https://github.com/sponsors/HamzaBenyazid)*

Your sponsorship helps:
 - Fund critical updates and bug fixes
 - Prioritize feature requests from sponsors
 - Keep the plugin free for everyone

---
### Table of Contents
**[Features](#-features)**<br>
**[What's New in v2?](#-whats-new-in-v2)**<br>
**[What's New in v2.1.0?](#-whats-new-in-v210)**<br>
**[Demo](#-demo)**<br>
**[Contributing](#-contributing)**<br>
**[License](#-contributing)**<br>

---


## 🚀 Features  
- **Dynamic Variables**: Define in frontmatter, update everywhere instantly.  
- **Code Block Magic**: Execute queries & transform data using code blocks.  
- **Smart Query Engine**:  
  - Built-in functions
  - Custom JavaScript execution
- **Custom Function Library**: Save frequent scripts (e.g., calculateTax) and call them by name!
- **Form Interface**: Insert queries visually—no coding skills needed!  
- **Cross-Note Sync**: Share variables across your entire vault.  

---

## 🎬 What's New in v2?  
### Code Block Support

https://github.com/user-attachments/assets/9e064696-f99a-4d9e-af4e-dc2f749ec569

### Smart Query Engine
- Build-in functions (SUM):

https://github.com/user-attachments/assets/a72f7e87-64ea-454b-ad91-10daff7588c9

- Custom JavaScript Quries:
  	- Used Examples
  		- A/B Testing Content
		```js
		() => {
		  return Math.random() > 0.5 ? "New UI" : "Legacy UI";
		}
		```
  		- Dynamic Checklists 
		```js
		(tasks) => { 
			const done = tasks.filter(t => t.completed).length; 
			const doneBar = '▣'.repeat(done); 
			const undoneBar = '□'.repeat(tasks.length - done); 
			const completionPercentage = Math.round((done / tasks.length) * 100);
			return doneBar + undoneBar + ' (' + completionPercentage +'% completed)'; 
		}
		```
	- **Demo**:

https://github.com/user-attachments/assets/979e4361-64b8-4d66-8f36-74d6fa1370df  

- Custom Fucntion Library:

https://github.com/user-attachments/assets/5affac22-1b86-4bf8-9993-15b9b023e4e8

- User friendly form for inserting queries: 
The form adds the arguments input dynamically and allows you the prview values of each argument and the value of the resulting query.
<img width="560" alt="query-form" src="https://github.com/user-attachments/assets/ebfe1a8c-5d62-47e3-bc6f-02cf565d5ef0" />

---

## 🆕 What's New in v2.1.0?  
### ✏️ Inline Editing
Edit existing Live Variables references without reinserting them! Just place your cursor on any variable reference and run `Live Variables: Query variables` to modify it in-place.

### 🔦 Smart Highlighting
Instantly identify dynamic content with subtle highlights that:
- Work in both light/dark modes
- Preserve Markdown formatting (disables highlight when styling is present)
- Help maintain visual hierarchy

This feature can be is enabled by default and can be disabled in the settings.

**Formatting Awareness:**  
`**boldVar**` → No highlight to preserve bold style  
`plainVar` → Highlighted for easy identification

### 🎥 Demo for two features
https://github.com/user-attachments/assets/c698453e-6e08-4793-b542-47fc39d9deeb

---

## Getting Started

1. **Install the Plugin**:
   - Install directly from the Obsidian plugin marketplace, or manually download the latest release, unzip it, and place the folder in your vault's plugin directory. Enable the plugin in Obsidian’s settings.

2. **Define Variables**:
   - Open the note where you want to use variables.
   - In the note’s frontmatter (the YAML block), define your variables. Example:
     ```yaml
     ---
     projectName: Obsidian Live Variables Plugin
     dueDate: 2024-12-31
     ---
     ```

3. **Insert Variables**:
   You can insert variables using the following options:
   - **Local Variables**: Insert a variable defined within the current note by using the command: `Live Variables: Insert local variable`.
   - **Vault-Wide Variables**: Insert a variable defined in any note within the vault by using the command: `Live Variables: Insert variable from another note`.
   - **Query variables**: Insert a live code blocks, live custom js function and your saved function by using command: `Live Variables: Query variables`.

4. **Update Variables**:
   - Modify the value of a variable in the note’s properties, and all references to that variable across your vault will be updated instantly.
  
## 🎥 Demo
Check out this quick demo of all of plugin's features in action:

https://github.com/user-attachments/assets/70361e83-5b84-4029-a7e9-e0e640e216d1

## 🤝 Contributing
We welcome contributions! If you have suggestions for improvements or new features, feel free to open an issue or submit a pull request.

## 📜 License
This project is licensed under the MIT License.

