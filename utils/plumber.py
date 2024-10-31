
import pdfplumber
import re
import sys
import json
import os

def get_token_count(text):
    tokens = text.split()
    return len(tokens)

def remove_home_header(text):
    header_start = 'Home >'
    # Find the start index of 'Home >'
    start_index = text.find(header_start)
    
    # If 'Home >' is not found, return the original text
    if start_index == -1:
        return text

    # Find the index of the newline character after 'Home >'
    end_index = text.find('\n', start_index)
    
    # If newline is found, remove the header, otherwise return text without 'Home >'
    if end_index != -1:
        # Remove the header by returning the text from after the newline character
        return text[end_index + 1:]
    else:
        # 'Home >' is found but no newline after it, return text without 'Home >'
        return text[start_index + len(header_start):]
    
def extract_header(text, header_start="Home >"):
    # Find the index where "Home >" starts
    start_index = text.find(header_start)
    if start_index != -1:
        # Find the index of the first newline character after "Home >"
        end_index = text.find('\n', start_index)
        # If a newline character is found after "Home >"
        if end_index != -1:
            # Extract the header up to the newline character
            return text[start_index:end_index].strip()
        else:
            # If there's no newline, return the text starting from "Home >"
            return text[start_index:].strip()
    return None  # Return None if "Home >" is not found

def clean_text(text):
    index_last_checked = 0
    while True:
        index_gt = text.find('>', index_last_checked)
        if index_gt == -1:
            break  # No more '>' found, exit loop
        
        # Find the next space after '>'
        index_space = text.find(' ', index_gt)
        if index_space == -1:
            break  # No more spaces found after the last '>', exit loop
        
        # Delete the space
        text = text[:index_space] + text[index_space+1:]
        
        # Update the index_last_checked to the position after the current '>'
        index_last_checked = index_gt + 1
    
    return text

def combine_multiline_header(header):
    # Split the header by newline to get individual lines
    lines = header.split('\n')
    
    combined = []
    buffer = ""
    for line in lines:
        # If buffer has PageContent and current line doesn't start with 'Home'
        if buffer and not line.startswith("Home"):
            buffer += " " + line.strip()  # .strip() to remove any leading/trailing whitespace
        else:
            if buffer:
                combined.append(buffer)
                buffer = ""
            buffer = line.strip()
    # Add any remaining PageContent in the buffer
    if buffer:
        combined.append(buffer)
    
    # Combine the processed lines back into a single string and replace '>' with '| '
    return '\n'.join(combined).replace('>', '| ')


def is_bold(char):
    return "Bold" in char.get("fontname", "")

def wrap_large_bold_sentences(text, chars):
    bold_sentences = []
    temp_sentence = ''
    inside_bold_sentence = False
    prev_y0 = chars[0]["y0"] if chars else None

    for idx, char in enumerate(chars):
        if inside_bold_sentence and abs(char["y0"] - prev_y0) > 10:
            temp_sentence += '\n'
        if is_bold(char) and char["size"] > 24:
            inside_bold_sentence = True
            temp_sentence += char["text"]
        else:
            if inside_bold_sentence:
                # Check if the bold sentence is standalone (either followed by a newline or it's the end of the text)
                if char["text"] == '\n':
                    # If next character is also bold and has a large font size, continue appending
                    if idx+1 < len(chars) and is_bold(chars[idx+1]) and chars[idx+1]["size"] > 24:
                        continue
                    else:
                        bold_sentences.append(temp_sentence)
                        temp_sentence = ''
                        inside_bold_sentence = False
                else:
                    break
        prev_y0 = char["y0"]

    # If there's a remaining bold sentence, add it
    if temp_sentence:
        bold_sentences.append(temp_sentence)

    # Wrap bold sentences with ^^ 
    for sentence in bold_sentences:
        # Skip sentences that start with *
        if text.startswith('*'):
            continue

        add_newline = False
        # Check if sentence ends with a newline
        if sentence.endswith('\n'):
            sentence = sentence.rstrip('\n')
            add_newline = True

        text = text.replace(sentence, f"**{sentence}**", 1)  # Only replace the first occurrence

        if add_newline:
            # Add back the newline after the ^^
            text = text.replace(f"^^{sentence}^^", f"^^{sentence}^^\n", 1)

    return text

def wrap_bold_text(text, chars, folder_name):
    # Extract bold text segments
    size_thresholds = {
    'SolidCAM Milling': {'large': 13, 'small': 8},
    'SolidCAM GPPTool': {'large': 16, 'small': 10},
    'SolidCAM Turning': {'large': 16, 'small': 10},
    'SolidCAM Wire': {'large': 16, 'small': 10},
    }
    default_thresholds = {'large': 16, 'small': 10}

    # Get custom thresholds for the file, or use defaults
    thresholds = size_thresholds.get(folder_name, default_thresholds)
    bold_text_segments = []
    inside_bold_segment = False
    temp_bold_string = ''
    prev_doctop = None
    prev_char_was_bold = False
    char_size = None

    def add_segment():
        nonlocal temp_bold_string, inside_bold_segment, char_size
        # Trim the segment to remove extra spaces
        trimmed_segment = temp_bold_string.strip()
        if trimmed_segment:
            bold_text_segments.append((trimmed_segment, prev_char_was_bold, char_size))
            temp_bold_string = ''
            inside_bold_segment = False

    for char in chars:
        # Check for new line based on doctop value
        new_line_detected = prev_doctop and abs(char["doctop"] - prev_doctop) > 10

        if is_bold(char):
            if not inside_bold_segment or new_line_detected or (char_size and char.get("size", 0) != char_size):
                add_segment()  # Close current segment and start a new one if there's a size change or new line
                inside_bold_segment = True
                char_size = char.get("size", 0)
            temp_bold_string += char["text"]
        else:
            add_segment()

        prev_doctop = char["doctop"]
        prev_char_was_bold = is_bold(char)

    add_segment()  # Add any remaining segment

    def wrap_segment(segment, size):
        if size >= thresholds['large']:
            return "****" + segment + "****"
        elif size > thresholds['small']:
            return "**" + segment + "**"
        else:
            return segment

    # Calculate start and end positions for each segment in the original text
    segments_with_positions = []
    for segment, prev_was_bold, size in bold_text_segments:
        start_pos = text.find(segment)
        end_pos = start_pos + len(segment)
        segments_with_positions.append((segment, start_pos, end_pos, size))

    # Sort segments by their start positions
    segments_with_positions.sort(key=lambda x: x[1])

    # Apply markdown, ensuring no overlaps
    for i, (segment, start, end, size) in enumerate(segments_with_positions):
        if segment != "Related Topics":
            wrapped_segment = wrap_segment(segment, size)
            # Check for overlapping with previous segments
            if i > 0 and start < segments_with_positions[i-1][2]:
                continue  # Skip segment if it overlaps
            text = text.replace(segment, wrapped_segment, 1)

    return text



def find_pages_starting_with(pdf_path, start_string):
    pages_content = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text and start_string in text:
                # Extract and clean the header
                header_extracted = extract_header(text)
                header = clean_text(header_extracted)
                header = combine_multiline_header(header)

                header_end_index = text.find(header_extracted) + len(header_extracted)
                page_content = text[header_end_index:].strip()
                chars = page.chars
                folder_name = os.path.basename(os.path.dirname(pdf_path))
                wrapped_text = wrap_bold_text(text, chars, folder_name)
                wrapped_text = wrap_large_bold_sentences(wrapped_text, chars)
                page_content = remove_home_header(wrapped_text)

                pages_content.append({
                    'page_number': page.page_number,
                    'header': header,
                    'pageContent': page_content
                })
                
            else:
                chars = page.chars
                folder_name = os.path.basename(os.path.dirname(pdf_path))
                wrapped_text = wrap_bold_text(text, chars, folder_name)
                wrapped_text = wrap_large_bold_sentences(wrapped_text, chars)
                page_content = remove_home_header(wrapped_text)
                pages_content.append({
                    'page_number': page.page_number,
                    'header': header,
                    'pageContent': page_content
                })
    return pages_content



#Removing Ralted Topics with hooks and link, avoiding removal of edge cases.


def has_special_character_in_last_three_lines(lines, current_index):
    """Check if there's a special character in the concatenated last three lines."""
    concatenated = ''.join(lines[current_index-3:current_index])
    
    # Check for a dash between uppercase letters
    if re.search(r'[A-Z]-[A-Z]', concatenated):
        return False

    # Check if the concatenated string starts with a pattern like "1." or "2."
    if re.match(r'^\d+\.', concatenated):
        return False
    
    special_characters = [':', '°']
    for char in special_characters:
        if char in concatenated:
            return True
            
    return False

def remove_related_topics_block(text):
    lines = text.split('\n')
    
    try:
        # Find the indices of the first and last occurrence of "Related Topics"
        start_index = lines.index("Related Topics")
        end_index = len(lines) - 1 - lines[::-1].index("Related Topics")

        # Remove the block between these indices, inclusive
        del lines[start_index:end_index + 1]
    except ValueError:
        # "Related Topics" not found, do nothing
        pass

    return '\n'.join(lines)



def append_related_topics(text):
    lines = text.split('\n')
    special_chars = ['.', ',', '?', '!', ';', ':', '>', '/']
    
    i = len(lines) - 1
    count_lines_without_special_chars = 0

    while i >= 0 and not any(lines[i].endswith(ch) for ch in special_chars):
        count_lines_without_special_chars += 1
        i -= 1

    # If at least two sentences adhere to the rules, append "Related Topics" at the bottom
    if count_lines_without_special_chars >= 2:
        lines.append("Related Topics")

    return '\n'.join(lines)

def process_solidcam_licence_text(text_file_path):
    results = []
    try:
        with open(text_file_path, 'r', encoding='utf-8') as text_file:
            lines = text_file.readlines()
            
            # Extract the first line as the link
            link = lines[0].strip()

            # Find the second line of text to use as the main header
            text_lines = [line.strip() for line in lines[1:] if line.strip()]  # Start from second line
            main_header = text_lines[0] if text_lines else None  # First non-empty line after the link

            # Join all lines for the page content, starting from the line after the main header
            page_content = " ".join(text_lines[1:]) if len(text_lines) > 1 else ""

            results.append({
                "header": f"{main_header} | {link}",
                "contents": [
                    {
                        "page_number": 0,
                        "PageContent": page_content
                    }
                ]
            })

    except FileNotFoundError:
        print(f"Text file {text_file_path} not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

    return results

def process_solidcam_postprocessor_text(text_file_path):
    results = []
    try:
        with open(text_file_path, 'r', encoding='utf-8', errors='replace') as text_file:
            lines = text_file.readlines()

            # Extract the first line as the link
            link = lines[0].strip()

            # Find the second line of text to use as the main header
            text_lines = [line.strip() for line in lines[1:] if line.strip()]
            main_header = text_lines[0] if text_lines else None

            # Initialize variables for splitting into chunks
            current_chunk = []
            current_header = None
            sub_header = None

            for line in text_lines[1:]:
                # Remove tabs for cleaner text
                line = line.replace("\t", " ")

                # Detect a new @ block to start a new main chunk
                if line.startswith("@"):
                    # Save the previous chunk if it exists
                    if current_chunk and current_header:
                        header_context = f"{main_header} | {current_header} | {sub_header or ''} | {link}"
                        results.append({
                            "header": header_context,
                            "contents": [
                                {
                                    "PageContent": " ".join(current_chunk)
                                }
                            ]
                        })
                    # Start a new chunk for the new @ block
                    current_header = line
                    sub_header = None  # Reset sub-header for new @ block
                    current_chunk = []  # Reset chunk content
                    if current_chunk and current_header:
                        header_context = f"{main_header} | {current_header} | {sub_header or ''} | {link}"
                        results.append({
                            "header": header_context,
                            "contents": [
                                {
                                    "PageContent": " ".join(current_chunk)
                                }
                            ]
                        })
                    # Update sub-header and reset chunk content for this new sub-section
                    sub_header = line
                    current_chunk = []

                # Add line to the current chunk without tabs
                current_chunk.append(line)

            # Append the final chunk if any content remains
            if current_chunk and current_header:
                header_context = f"{main_header} | {current_header} | {sub_header or ''} | {link}"
                results.append({
                    "header": header_context,
                    "contents": [
                        {
                            "PageContent": " ".join(current_chunk)
                        }
                    ]
                })

    except FileNotFoundError:
        print(f"Text file {text_file_path} not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

    return results



def process_solidcam_general_faq_webinars(text_file_path):
    results = []
    try:
        with open(text_file_path, 'r', encoding='utf-8') as text_file:
            lines = text_file.readlines()

            # Initialize a list to hold the current Q&A block
            qa_block = []
            for line in lines[1:]:  # Skip the "General_FAQ" header
                line = line.strip()
                if line:  # If the line is not empty, add it to the current Q&A block
                    qa_block.append(line)
                else:  # If the line is empty, it means the end of the current Q&A block
                    if qa_block:  # Check if there's a Q&A block to process
                        # Process the Q&A block to extract the question and answers
                        question = qa_block[0]  # The first line of the block is the question
                        answers = " ".join(qa_block[1:])  # Join the rest of the block as the answers
                        results.append({
                            "header": f"General_FAQ_Webinars | {question}",
                            "contents": [
                                {
                                    "page_number": 0,
                                    "PageContent": answers
                                }
                            ]
                        })
                        qa_block = []  # Reset the Q&A block for the next one
            
            # Process any remaining Q&A block after the loop
            if qa_block:
                question = qa_block[0]
                answers = " ".join(qa_block[1:])
                results.append({
                    "header": f"General_FAQ_Webinars | {question}",
                    "contents": [
                        {
                            "page_number": 0,
                            "PageContent": answers
                        }
                    ]
                })

    except FileNotFoundError:
        print(f"Text file {text_file_path} not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

    return results

def process_solidcam_general_faq(text_file_path):
    results = []
    try:
        with open(text_file_path, 'r', encoding='utf-8') as text_file:
            lines = text_file.readlines()

            # Initialize a list to hold the current Q&A block
            qa_block = []
            for line in lines[1:]:  # Skip the "General_FAQ" header
                line = line.strip()
                if line:  # If the line is not empty, add it to the current Q&A block
                    qa_block.append(line)
                else:  # If the line is empty, it means the end of the current Q&A block
                    if qa_block:  # Check if there's a Q&A block to process
                        # Process the Q&A block to extract the question and answers
                        question = qa_block[0]  # The first line of the block is the question
                        answers = " ".join(qa_block[1:])  # Join the rest of the block as the answers
                        results.append({
                            "header": f"General_FAQ | {question}",
                            "contents": [
                                {
                                    "page_number": 0,
                                    "PageContent": answers
                                }
                            ]
                        })
                        qa_block = []  # Reset the Q&A block for the next one
            
            # Process any remaining Q&A block after the loop
            if qa_block:
                question = qa_block[0]
                answers = " ".join(qa_block[1:])
                results.append({
                    "header": f"General_FAQ | {question}",
                    "contents": [
                        {
                            "page_number": 0,
                            "PageContent": answers
                        }
                    ]
                })

    except FileNotFoundError:
        print(f"Text file {text_file_path} not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

    return results



def process_webinar_text(text_file_path):
    results = []
    try:
        with open(text_file_path, 'r', encoding='utf-8') as text_file:
            main_header = None  # Initialize main_header as None
            for line in text_file:
                line = line.strip()
                if line:  # Check if the line contains text
                    main_header = line  # Set main_header
                    break  # Exit the loop
            remaining_lines = text_file.readlines()
            
            paragraphs = []
            current_paragraph = []
            for line in remaining_lines:
                line = line.strip()
                if line:
                    current_paragraph.append(line)
                else:
                    if current_paragraph:
                        paragraphs.append(" ".join(current_paragraph))
                        current_paragraph = []
            
            if current_paragraph:
                paragraphs.append(" ".join(current_paragraph))
            
            for paragraph in paragraphs:
                first_paren_index = paragraph.find('(')
                if first_paren_index != -1:
                    first_line = paragraph[:first_paren_index].strip()
                    rest_of_paragraph = paragraph[first_paren_index:]
                else:
                    first_line = paragraph
                    rest_of_paragraph = ''
                
                # Add an additional '|' after 'first_line'
                header_and_first_line = f"{main_header} | {first_line} |"
                
                paragraph_data = {
                    "header": header_and_first_line,
                    "contents": [
                        {
                            "page_number": 0,
                            "PageContent": rest_of_paragraph
                        }
                    ]
                }
                results.append(paragraph_data)

            
    except FileNotFoundError:
        print(f"Text file {text_file_path} not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

    return results

def format_header(header_text):
    # Add a space between a digit and an alphabetic character
    # Only if the digit is not followed by 'D' (as in '3D')
    formatted_header = re.sub(r'(\d)(?![Dd]\b)([A-Za-z])', r'\1 \2', header_text)

    # Remove digits followed immediately by a letter (not including 'D' following a digit)
    formatted_header = re.sub(r'^\d+(?![A-Za-z]|[Dd]\b)', '', formatted_header)

    # Remove one or two-digit numbers followed by space(s)
    # Exclude cases where a number is followed by 'D' or 'd' (as in '3D')
    formatted_header = re.sub(r'\b\d{1,2}\s+(?![Dd]\b)', '', formatted_header)

    # Add a space between a lowercase letter and a following uppercase letter
    formatted_header = re.sub(r'([a-z])([A-Z])', r'\1 \2', formatted_header)

    #remove previous letter if there is 53-axis to 3-axis
    formatted_header = re.sub(r'\b\d*(\d-)', r'\1', formatted_header)

    #remove numbers at the end of the string 
    formatted_header = re.sub(r'\d+$', '', formatted_header)

    # Replace multiple spaces with a single space
    formatted_header = re.sub(r'\s{2,}', ' ', formatted_header)

    # Replace "i Machining" with "iMachining"
    formatted_header = formatted_header.replace("i Machining", "iMachining")

    # Replace "Solid CAM" with "SolidCAM"
    formatted_header = formatted_header.replace("Solid CAM", "SolidCAM")

    # Add a space after "NX" if it's followed by an uppercase letter without a space
    formatted_header = re.sub(r'(NX)([A-Z])', r'\1 \2', formatted_header)

    return formatted_header

def extract_and_format_pdf_content_for_operators(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_content = []
            main_header_found = False  # Flag to track if the main header has been found

            for page in pdf.pages:  # Process only the first 10 pages
                chars = page.chars
                header_text = ""
                in_header = False

                # Extract and format header
                for char in chars:
                    if char['size'] > 16:
                        header_text += char['text']
                        in_header = True
                    elif in_header:
                        break

                formatted_header = ""
                if header_text:
                    if not main_header_found:
                        formatted_header = f'**** {header_text.strip()} ****\n'
                        main_header_found = True
                    else:
                        formatted_header = f'*** {header_text.strip()} ***\n'

                # Extract the rest of the page content
                rest_of_page = page.extract_text() or ""
                page_content = formatted_header + rest_of_page

                pages_content.append({
                    'page_number': page.page_number,
                    'header': header_text,
                    'pageContent': page_content
                })

        return pages_content

    except Exception as e:
        print(f"An error occurred while extracting and formatting content: {e}")
        return []
    
def extract_and_format_pdf_solidcam_silent_install(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_content = []
            last_header_text = ""  # Variable to store the last header text

            for page in pdf.pages:
                chars = page.chars
                header_text = ""
                in_header = False

                # Extract and format header
                for char in chars:
                    if char['size'] > 16:
                        header_text += char['text']
                        in_header = True
                    elif in_header:
                        break

                # If the current header text is empty, use the last header text
                if not header_text and last_header_text:
                    header_text = last_header_text
                elif header_text:
                    last_header_text = header_text  # Update last header text

                # Extract the rest of the page content
                rest_of_page = page.extract_text() or ""
                page_content = rest_of_page

                pages_content.append({
                    'page_number': page.page_number,
                    'header': header_text,
                    'pageContent': page_content
                })

        return pages_content

    except Exception as e:
        print(f"Error processing PDF: {e}")
        return []

def extract_and_format_pdf_training_course(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_content = []
            first_header_part = ""
            second_header_part = ""
            third_header_part = ""  # Variable to store the current NimbusSan header text
            formatted_third_header = ""  # Formatted third header to use across pages
            combined_header = ""
            combined_header_found = False
            header_to_use = ""

            for page_number, page in enumerate(pdf.pages, start=1):
                chars = page.chars
                current_page_third_header_part = ""  # Variable to accumulate third header on the current page

                for char in chars:
                    if not combined_header_found:
                        if char['size'] > 35 and "DIN2014" in char['fontname']:
                            first_header_part += char['text']
                        elif char['size'] > 29 and "NimbusSan" in char['fontname']:
                            second_header_part += char['text']

                    # After the combined header is found, look for additional NimbusSan headers
                    elif char['size'] > 29 and "NimbusSan" in char['fontname']:
                        current_page_third_header_part += char['text']

                # Set the combined header if it has not been set yet
                if first_header_part and second_header_part and not combined_header_found:
                    formatted_second_header = format_header(second_header_part)
                    combined_header = f'{first_header_part} | {formatted_second_header}'
                    combined_header_found = True

                # If new text for the third header part is found on this page, update the third header
                if current_page_third_header_part != "":
                    # Replace third_header_part with the new text and format it
                    third_header_part = current_page_third_header_part
                    formatted_third_header = format_header(third_header_part)

                # The header for the current page includes the combined header and the third header if present
                header_text = f'{combined_header} | {formatted_third_header}' if formatted_third_header else combined_header

                header_text = ' | '.join(part.strip() for part in header_text.split('|'))
                

                #because header is empty on the first 2 pages, I want to replace it with the true header which is on page 3
                if page_number == 3:
                    header_to_use = header_text

                rest_of_page = page.extract_text() or ""
                page_content = rest_of_page

                pages_content.append({
                    'page_number': page.page_number,
                    'header': header_text,
                    'pageContent': page_content
                })

            # Replace empty headers with the header from page 003
            if header_to_use:
                for page in pages_content:
                    if not page['header']:
                        page['header'] = header_to_use

            return pages_content

    except Exception as e:
        print(f"Error processing PDF: {e}")
        return []

def extract_and_format_pdf_solidcam_2023_application(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_content = []
            first_header_part = ""
            second_header_part = ""
            combined_header = ""
            header_found = False
            header_to_use = ""

            for page_number, page in enumerate(pdf.pages, start=1):
                chars = page.chars

                for char in chars:
                    if not header_found:
                        if char['size'] > 35 and "DIN2014" in char['fontname']:
                            first_header_part += char['text']
                        
                    if char['size'] > 29 and "NimbusSan" in char['fontname']:
                            second_header_part += char['text']

                # Set the combined header if it has not been set yet
                if first_header_part and second_header_part:
                    formatted_second_header = format_header(second_header_part)
                    combined_header = f'{first_header_part} | {formatted_second_header}'
                    header_found = True
                    second_header_part = ""

                # The header for the current page includes the combined header and the third header if present
                header_text = f'{combined_header}'

                header_text = ' | '.join(part.strip() for part in header_text.split('|'))
                

                #because header is empty on the first 3 pages, I want to replace it with the true header which is on page 4
                if page_number == 4:
                    header_to_use = header_text

                rest_of_page = page.extract_text() or ""
                page_content = rest_of_page

                pages_content.append({
                    'page_number': page.page_number,
                    'header': header_text,
                    'pageContent': page_content
                })

            # Replace empty headers with the header from page 003
            if header_to_use:
                for page in pages_content:
                    if not page['header']:
                        page['header'] = header_to_use

            return pages_content

    except Exception as e:
        print(f"Error processing PDF: {e}")
        return []

def extract_and_format_pdf_faq_imachining(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_content = []
            first_header_part = ""
            second_header_part = ""
            combined_header = ""
            header_found = False
            header_to_use = ""

            for page_number, page in enumerate(pdf.pages, start=1):
                chars = page.chars

                for char in chars:
                    if not header_found:
                        if (char['size'] > 35 and "DIN2014" in char['fontname']) or (char['size'] == 30 and ("JZNXXG+SourceSansPro-Regular" or "LCMJZC+SourceSansPro-Semibold" in char['fontname'])):
                            first_header_part += char['text']
                        
                    if char['size'] > 17 and "Calibri" in char['fontname']:
                            second_header_part += char['text']

                # Set the combined header if it has not been set yet
                if first_header_part and second_header_part:
                    formatted_first_header = format_header(first_header_part)
                    formatted_second_header = format_header(second_header_part)
                    combined_header = f'{formatted_first_header} | {formatted_second_header}'
                    header_found = True
                    second_header_part = ""

                # The header for the current page includes the combined header and the third header if present
                header_text = f'{combined_header}'

                header_text = ' | '.join(part.strip() for part in header_text.split('|'))
                

                #because header is empty on the first 3 pages, I want to replace it with the true header which is on page 4
                if page_number == 4:
                    header_to_use = header_text

                rest_of_page = page.extract_text() or ""
                page_content = rest_of_page

                pages_content.append({
                    'page_number': page.page_number,
                    'header': header_text,
                    'pageContent': page_content
                })

            # Replace empty headers with the header from page 003
            if header_to_use:
                for page in pages_content:
                    if not page['header']:
                        page['header'] = header_to_use

            return pages_content

    except Exception as e:
        print(f"Error processing PDF: {e}")
        return []
    
def extract_and_format_pdf_Toolkit_reference(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_content = []
            first_header_part = ""
            second_header_part = ""
            combined_header = ""
            header_found = False
            header_to_use = ""

            for page_number, page in enumerate(pdf.pages, start=1):
                chars = page.chars

                for char in chars:
                    if not header_found:
                        if char['size'] > 29 and "HelveticaNeue" in char['fontname']:
                            first_header_part += char['text']
                        
                    if char['size'] >= 24 and "Helvetica-Black" in char['fontname']:
                            second_header_part += char['text']

                # Set the combined header if it has not been set yet
                if first_header_part and second_header_part:
                    formatted_second_header = format_header(second_header_part)
                    combined_header = f'{first_header_part} | {formatted_second_header}'
                    header_found = True
                    second_header_part = ""

                # The header for the current page includes the combined header and the third header if present
                header_text = f'{combined_header}'

                header_text = ' | '.join(part.strip() for part in header_text.split('|'))
                

                #because header is empty on the first 4 pages, I want to replace it with the true header which is on page 4
                if page_number == 5:
                    header_to_use = header_text

                rest_of_page = page.extract_text() or ""
                page_content = rest_of_page

                pages_content.append({
                    'page_number': page.page_number,
                    'header': header_text,
                    'pageContent': page_content
                })

            # Replace empty headers with the header from page 003
            if header_to_use:
                for page in pages_content:
                    if not page['header']:
                        page['header'] = header_to_use

            return pages_content

    except Exception as e:
        print(f"Error processing PDF: {e}")
        return []

def extract_and_format_pdf_solidcam_forum(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_content = []
            first_header_part = ""
            second_header_part = ""
            combined_header = ""
            header_found = False
            header_to_use = ""

            for page_number, page in enumerate(pdf.pages, start=1):
                chars = page.chars

                for char in chars:
                    if not header_found:
                        if char['size'] > 35 and ("DIN2014" in char['fontname'] or "Oranienbaum" in char['fontname'] or 'CenturyGothic' in char['fontname']):
                            first_header_part += char['text']

                # Set the combined header if it has not been set yet
                if first_header_part:
                    first_header_part = format_header(first_header_part)
                    header_found = True


                # The header for the current page includes the combined header and the third header if present
                header_text = f'{first_header_part}'

                header_text = ' | '.join(part.strip() for part in header_text.split('|'))               

                rest_of_page = page.extract_text() or ""
                page_content = rest_of_page

                pages_content.append({
                    'page_number': page.page_number,
                    'header': header_text,
                    'pageContent': page_content
                })

            return pages_content

    except Exception as e:
        print(f"Error processing PDF: {e}")
        return []

def extract_and_format_pdf_faq_nx_imachining(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_content = []
            first_header_part = ""
            second_header_part = ""
            combined_header = ""
            header_found = False
            header_to_use = ""

            for page_number, page in enumerate(pdf.pages, start=1):
                chars = page.chars

                for char in chars:
                    if not header_found:
                        if char['size'] > 35 and "DIN2014" in char['fontname']:
                            first_header_part += char['text']
                        
                    if char['size'] > 17 and "Calibri" in char['fontname']:
                            second_header_part += char['text']

                # Set the combined header if it has not been set yet
                if first_header_part and second_header_part:
                    formatted_second_header = format_header(second_header_part)
                    combined_header = f'{first_header_part} | {formatted_second_header}'
                    header_found = True
                    second_header_part = ""

                # The header for the current page includes the combined header and the third header if present
                header_text = f'{combined_header}'

                header_text = ' | '.join(part.strip() for part in header_text.split('|'))
                

                #because header is empty on the first 3 pages, I want to replace it with the true header which is on page 4
                if page_number == 4:
                    header_to_use = header_text

                rest_of_page = page.extract_text() or ""
                page_content = rest_of_page

                pages_content.append({
                    'page_number': page.page_number,
                    'header': header_text,
                    'pageContent': page_content
                })

            # Replace empty headers with the header from page 003
            if header_to_use:
                for page in pages_content:
                    if not page['header']:
                        page['header'] = header_to_use

            return pages_content

    except Exception as e:
        print(f"Error processing PDF: {e}")
        return []

def extract_and_format_pdf_nx_imachining(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_content = []
            first_header_part = ""
            second_header_part = ""
            third_header_part = ""  # Variable to store the current NimbusSan header text
            formatted_third_header = ""  # Formatted third header to use across pages
            combined_header = ""
            combined_header_found = False
            header_to_use = ""

            for page_number, page in enumerate(pdf.pages, start=1):
                chars = page.chars
                current_page_third_header_part = ""  # Variable to accumulate third header on the current page

                for char in chars:
                    if not combined_header_found:
                        if char['size'] == 30 and "HelveticaNeue-MediumItalic" in char['fontname']:
                            first_header_part += char['text']
                        elif char['size'] ==25 and "HelveticaNeue-MediumItalic" in char['fontname']:
                            second_header_part += char['text']

                    # After the combined header is found, look for additional NimbusSan headers
                    elif char['size'] == 14.5 and "Calibri-Bold" in char['fontname']:
                        current_page_third_header_part += char['text']

                # Set the combined header if it has not been set yet
                if first_header_part and second_header_part and not combined_header_found:
                    formatted_second_header = format_header(second_header_part)
                    combined_header = f'{first_header_part} | {formatted_second_header}'
                    combined_header_found = True

                # If new text for the third header part is found on this page, update the third header
                if current_page_third_header_part != "":
                    # Replace third_header_part with the new text and format it
                    third_header_part = current_page_third_header_part
                    formatted_third_header = format_header(third_header_part)

                # The header for the current page includes the combined header and the third header if present
                header_text = f'{combined_header} | {formatted_third_header}' if formatted_third_header else combined_header

                header_text = ' | '.join(part.strip() for part in header_text.split('|'))
                

                #because header is empty on the first 2 pages, I want to replace it with the true header which is on page 3
                if page_number == 3:
                    header_to_use = header_text

                rest_of_page = page.extract_text() or ""
                page_content = rest_of_page

                pages_content.append({
                    'page_number': page.page_number,
                    'header': header_text,
                    'pageContent': page_content
                })

            # Replace empty headers with the header from page 003
            if header_to_use:
                for page in pages_content:
                    if not page['header']:
                        page['header'] = header_to_use

            return pages_content

    except Exception as e:
        print(f"Error processing PDF: {e}")
        return []


def extract_and_format_pdf_automation(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_content = []
            combined_header = ""
            combined_header_found = False
            header_to_use = ""

            for page_number, page in enumerate(pdf.pages, start=1):
                chars = page.chars
                current_page_header_part = ""

                for char in chars:
                    # Combine header parts if the font and size conditions are met
                    if 'ArialBold' in char['fontname'] and char['size'] > 14.4 and char['size'] < 15:
                        current_page_header_part += char['text']

                # Set the combined header if it has not been set yet and we are on the first page with header content
                if current_page_header_part:
                    combined_header = "SolidCAM API Help - " + current_page_header_part.strip()
                    combined_header_found = True

                # Update header for the page
                header_text = combined_header

                # On the first occurrence of a non-empty header, use it for the first two pages as well
                header_to_use = "SolidCAM API Help"

                rest_of_page = page.extract_text() or ""
                page_content = rest_of_page

                pages_content.append({
                    'page_number': page.page_number,
                    'header': header_text,
                    'pageContent': page_content + "\nType: 'API', Category: 'API Documentation' 'Tags: SolidCAM API"
                })


            # Replace empty headers with the header from page 003
            if header_to_use:
                for page in pages_content:
                    if not page['header']:
                        page['header'] = header_to_use

            return pages_content

    except Exception as e:
        print(f"Error processing PDF: {e}")
        return []

import os

def extract_and_format_api_examples(folder_path):
    pages_content = []
    try:
        # Walk through directory and subdirectories
        for root, dirs, files in os.walk(folder_path):
            for filename in files:
                if filename.endswith('.vbs'):  # Check if the file ends with .vbs
                    file_path = os.path.join(root, filename)  # Full path to the file
                    with open(file_path, 'r') as file:
                        code_content = file.read()  # Read the content of the .vbs file

                        # Append the file name and content to the pages_content list
                        pages_content.append({
                            'page_number': '////////',  # page_number is always 0, as each file is treated as a page
                            'header': filename + " Type: 'Visual Basic Scripting', Category: 'Visual Basic' 'Tags: VBS, API\n",
                            'pageContent': code_content
                        })
        return pages_content
    except Exception as e:
        print(f"Error processing files: {e}")
        return []


def extract_and_format_pdf_whats_new(folder_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_content = []
            first_header_part = ""
            second_header_part = ""
            combined_header = ""
            header_found = False
            header_to_use = ""

            for page_number, page in enumerate(pdf.pages, start=1):
                chars = page.chars

                for char in chars:
                    if not header_found:
                        if char['size'] > 37 and "Roboto-Regular" in char['fontname']:
                            first_header_part += char['text']
                        
                    if char['size'] >= 24 and "Roboto-Bold" in char['fontname']:
                        second_header_part += char['text']

                # Set the combined header if it has not been set yet
                if first_header_part and second_header_part:
                    # Ensure there's a space between "SolidCAM 2024" and "New Functionalities"
                    first_header_part = first_header_part.replace("SolidCAM 2024New", "SolidCAM 2024 New")

                    formatted_second_header = format_header(second_header_part)
                    combined_header = f'{first_header_part} | {formatted_second_header}'
                    header_found = True
                    second_header_part = ""

                # The header for the current page includes the combined header and the third header if present
                header_text = f'{combined_header}'

                header_text = ' | '.join(part.strip() for part in header_text.split('|'))
                
                # Because header is empty on the first 3 pages, replace it with the true header from page 4
                if page_number == 4:
                    header_to_use = header_text

                rest_of_page = page.extract_text() or ""
                page_content = rest_of_page

                pages_content.append({
                    'page_number': page.page_number,
                    'header': header_text,
                    'pageContent': page_content
                })

            # Replace empty headers with the header from page 003
            if header_to_use:
                for page in pages_content:
                    if not page['header']:
                        page['header'] = header_to_use

            return pages_content

    except Exception as e:
        print(f"Error processing PDF: {e}")
        return []





def extract_font_details_first_page(pdf_path, page_number):
    font_details_list = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            first_page = pdf.pages[page_number]
            for char in first_page.chars:
                font_details = {
                    'text': char['text'],
                    'font_name': char['fontname'],
                    'font_size': char['size']
                }
                font_details_list.append(font_details)
    except Exception as e:
        print(f"Error processing the PDF: {e}")

    return font_details_list
    
if __name__ == "__main__":
    pdf_path = sys.argv[1]  # Get the PDF path from the command line argument
    folder_name = os.path.basename(os.path.dirname(pdf_path))
    # Check if 'webinar' is in the file name
    if pdf_path.endswith(('.txt', '.gpp')):
        if re.search(r'\bWebinar\b', pdf_path, re.IGNORECASE):
            results = process_webinar_text(pdf_path)
            sys.stdout.write(json.dumps(results))
        elif 'SolidCAM_licensing' in pdf_path:
            results = process_solidcam_licence_text(pdf_path)
            sys.stdout.write(json.dumps(results))
        elif 'postprocessors' in pdf_path:
            results = process_solidcam_postprocessor_text(pdf_path)
            sys.stdout.write(json.dumps(results))
        elif 'General_FAQ_Webinars' in pdf_path:
            results = process_solidcam_general_faq_webinars(pdf_path)
            sys.stdout.write(json.dumps(results))
        elif 'General_FAQ' in pdf_path:
            results = process_solidcam_general_faq(pdf_path)
            sys.stdout.write(json.dumps(results))
            pass
    else:
        try:
            pages_ = find_pages_starting_with(pdf_path, "Home >")
        except:
            if 'solidcam for operator' in pdf_path.lower():
                pages_ = extract_and_format_pdf_content_for_operators(pdf_path)
            elif 'solidcam_silent_install' in pdf_path.lower():
                pages_ = extract_and_format_pdf_solidcam_silent_install(pdf_path)
            elif 'solidcam_2023_milling' in pdf_path.lower():
                pages_ = extract_and_format_pdf_training_course(pdf_path)
            elif 'solidcam_2023_application' in pdf_path.lower():
                pages_ = extract_and_format_pdf_solidcam_2023_application(pdf_path)
            elif 'solidcam_forum' in pdf_path.lower():
                pages_ = extract_and_format_pdf_solidcam_forum(pdf_path)
            elif 'faq_imachining' in pdf_path.lower():
                pages_ = extract_and_format_pdf_faq_imachining(pdf_path)
            elif 'toolkit_reference' in pdf_path.lower():
                pages_ = extract_and_format_pdf_Toolkit_reference(pdf_path)
            elif 'nx_imachining' in pdf_path.lower():
                pages_ = extract_and_format_pdf_nx_imachining(pdf_path)
            elif 'automation' in pdf_path.lower():
                # first_page = extract_font_details_first_page(pdf_path, 1)
                # print(first_page)
                pages_ = extract_and_format_pdf_automation(pdf_path)
            elif 'api_examples' in pdf_path.lower():
                # first_page = extract_font_details_first_page(pdf_path, 1)
                # print(first_page)
                pages_ = extract_and_format_api_examples(pdf_path)
            elif 'whats_new' in pdf_path.lower():
                #first_page = extract_font_details_first_page(pdf_path, 1)
                pages_ = extract_and_format_pdf_whats_new(pdf_path)
                #print(first_page)
        # print(pages_with_home)
        # input()

        grouped_results = {}

        for page_info in pages_:
            
            try:
                header = combine_multiline_header(page_info['header'])
            except:
                pass
            try:
                if header not in grouped_results:
                    grouped_results[header] = []
            except:
                pass

            # Access 'page_number' and 'pageContent' directly from the page_info dictionary
            page_number = page_info['page_number']
            PageContent_text = page_info['pageContent']  # Make sure this key matches the exact key in your dictionary

            # Append "Related Topics" where necessary
            PageContent_text = append_related_topics(PageContent_text)
            # Clean the PageContent using the remove_related_topics_sentences function
            PageContent_text = remove_related_topics_block(PageContent_text)
            # print(PageContent_text)
            # input()
            # Store the cleaned PageContent with its page number
            content_data = {
                "page_number": page_number,
                "PageContent": PageContent_text
            }
            try:
                grouped_results[header].append(content_data)
            except:
                grouped_results.append(content_data)



        # Convert the dictionary to a list format
        try:
            results = [{"header": key, "contents": value} for key, value in grouped_results.items()]
            for item in results:
                item['header'] = item['header'].replace("Home", folder_name)
        except:
            pass
        # if results:
        #     results.pop()
        # print('results:', results)
        # input()
        sys.stdout.write(json.dumps(results))





